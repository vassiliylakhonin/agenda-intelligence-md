"""Offline ACP trace checks for one USD item, two branches and a refund handoff.

This bounded readiness profile checks supplied evidence, never buys or refunds.
Merchant data and recorded exchanges do not independently prove live behavior.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import time
import urllib.parse
from datetime import datetime
from importlib.resources import files
from pathlib import Path
from typing import Any

from jsonschema import Draft202012Validator, FormatChecker
from referencing import Registry

REVISION = "2026-04-17"
CONTRACT = "agent-checkout-readiness.v1"
REQUEST_DEFS = {
    "create": "CheckoutSessionCreateRequest",
    "cancel": "CancelSessionRequest",
    "complete": "CheckoutSessionCompleteRequest",
}
SEQUENCES = {
    "cancel": ["create", "retry_create", "cancel", "retry_cancel"],
    "purchase": ["create", "retry_create", "complete", "retry_complete", "refund_handoff", "retry_refund_handoff"],
}


def _official_schema() -> tuple[dict, dict]:
    root = files("agenda_intelligence").joinpath("data", "protocols", "acp", REVISION)
    raw = root.joinpath("checkout.schema.json").read_bytes()
    provenance = json.loads(root.joinpath("provenance.json").read_text())
    if hashlib.sha256(raw).hexdigest() != provenance["sha256"]:
        raise ValueError("Vendored protocol schema checksum mismatch")
    return json.loads(raw), provenance


def _https(value: Any) -> bool:
    if not isinstance(value, str):
        return False
    parsed = urllib.parse.urlsplit(value)
    return parsed.scheme == "https" and bool(parsed.hostname) and not parsed.username and not parsed.password


def check_checkout(trace: dict, *, now: float | None = None) -> dict:
    """Evaluate an owner-recorded trace; no network, credentials or side effects."""
    schema, provenance = _official_schema()
    issues: list[dict] = []

    def need(condition: bool, code: str, path: str) -> None:
        if not condition:
            issues.append({"code": code, "path": path})

    def validate(value: dict, definition: str, path: str) -> None:
        validator = Draft202012Validator(
            {**schema, "$ref": "#/$defs/" + definition}, format_checker=FormatChecker(), registry=Registry()
        )
        for error in list(validator.iter_errors(value))[:10]:
            issues.append({"code": "acp_schema_invalid", "path": path + "/" + "/".join(map(str, error.path))})

    def totals(rows: list, expected: dict, path: str) -> None:
        actual = {row["type"]: row["amount"] for row in rows}
        need(len(actual) == len(rows), "duplicate_total", path)
        for kind, amount in expected.items():
            need(type(actual.get(kind)) is int and actual[kind] == amount, "total_mismatch", path + "/" + kind)
        for kind, amount in actual.items():
            need(type(amount) is int and amount >= 0, "invalid_money", path + "/" + kind)
            need(kind in expected or amount == 0, "unsupported_nonzero_adjustment", path + "/" + kind)

    try:
        need(trace["protocol"] == "ACP" and trace["revision"] == REVISION, "unsupported_protocol", "/revision")
        snapshot, intent = trace["merchant_snapshot"], trace["intent"]
        observed = datetime.fromisoformat(snapshot["observed_at"].replace("Z", "+00:00"))
        need(observed.tzinfo is not None, "snapshot_timezone_required", "/merchant_snapshot/observed_at")
        clock = time.time() if now is None else now
        need(-5 <= clock - observed.timestamp() <= 300, "stale_snapshot", "/merchant_snapshot/observed_at")
        need(intent["currency"] == snapshot["currency"] == "usd", "currency_mismatch", "/intent/currency")
        need(type(intent["quantity"]) is int and intent["quantity"] == 1, "profile_requires_quantity_one", "/intent")
        for key in ("item_id", "product_id", "variant_id", "unit_amount"):
            need(intent[key] == snapshot[key], "catalog_mismatch", "/intent/" + key)
        for key in ("unit_amount", "tax_amount", "fulfillment_amount", "available_quantity"):
            need(
                type(snapshot[key]) is int and snapshot[key] >= 0, "invalid_catalog_number", "/merchant_snapshot/" + key
            )
        need(snapshot["available_quantity"] >= 1, "out_of_stock", "/merchant_snapshot/available_quantity")
        need(_https(snapshot["refund_handoff_url"]), "invalid_refund_handoff", "/merchant_snapshot/refund_handoff_url")
        subtotal = snapshot["unit_amount"]
        total = subtotal + snapshot["tax_amount"] + snapshot["fulfillment_amount"]
        expected = {
            "subtotal": subtotal,
            "tax": snapshot["tax_amount"],
            "fulfillment": snapshot["fulfillment_amount"],
            "total": total,
        }
        exchanges = trace["exchanges"]
        need(isinstance(exchanges, list) and len(exchanges) <= 20, "exchange_limit", "/exchanges")
        if not isinstance(exchanges, list) or len(exchanges) > 20:
            raise ValueError("exchange_limit")
        known = {"cancel", "purchase"}
        need(all(row.get("branch") in known for row in exchanges), "unknown_branch", "/exchanges")
        seen_keys: dict[str, tuple] = {}
        sessions: set[str] = set()
        for branch, sequence in SEQUENCES.items():
            rows = [row for row in exchanges if row.get("branch") == branch]
            need([row["operation"] for row in rows] == sequence, "scenario_sequence_incomplete", "/" + branch)
            session_id, order_id = None, None
            prior: dict[str, dict] = {}
            for index, row in enumerate(rows):
                path = "/" + branch + "/" + str(index)
                operation = row["operation"]
                base = operation.removeprefix("retry_")
                request, response = row["request"], row["response"]
                need(type(row["http_status"]) is int and 200 <= row["http_status"] < 300, "request_failed", path)
                key = row["idempotency_key"]
                need(isinstance(key, str) and 0 < len(key) <= 256, "idempotency_key_required", path)
                identity = (branch, base, json.dumps(request, sort_keys=True, allow_nan=False))
                if key in seen_keys:
                    need(seen_keys[key] == identity, "idempotency_key_collision", path)
                else:
                    seen_keys[key] = identity
                if operation.startswith("retry_"):
                    original = prior.get(base)
                    need(
                        original is not None
                        and all(row.get(k) == original.get(k) for k in ("request", "response", "idempotency_key")),
                        "retry_changed_result",
                        path,
                    )
                else:
                    prior[base] = row
                if base == "refund_handoff":
                    need(branch == "purchase" and bool(order_id), "refund_before_order", path)
                    need(row.get("url") == snapshot["refund_handoff_url"], "refund_destination_mismatch", path)
                    need(
                        request == {"order_id": order_id, "amount": total, "currency": "usd"},
                        "refund_request_mismatch",
                        path,
                    )
                    need(
                        type(request.get("amount")) is int and type(response.get("amount")) is int,
                        "invalid_money",
                        path,
                    )
                    need(
                        response.get("status") == "accepted"
                        and bool(response.get("refund_id"))
                        and response.get("order_id") == order_id
                        and response.get("amount") == total
                        and response.get("currency") == "usd",
                        "refund_handoff_not_accepted",
                        path,
                    )
                    continue
                if base not in REQUEST_DEFS:
                    need(False, "unsupported_operation", path)
                    continue
                validate(request, REQUEST_DEFS[base], path + "/request")
                validate(
                    response,
                    "CheckoutSessionWithOrder" if base == "complete" else "CheckoutSession",
                    path + "/response",
                )
                if base == "create":
                    need(
                        request.get("line_items") == [{"id": intent["item_id"]}] and request.get("currency") == "usd",
                        "create_intent_mismatch",
                        path,
                    )
                    if session_id is None:
                        session_id = response["id"]
                        need(session_id not in sessions, "branches_share_session", path)
                        sessions.add(session_id)
                need(response["id"] == session_id, "session_binding_mismatch", path)
                if base != "create":
                    need(row.get("session_id") == session_id, "request_session_mismatch", path)
                need(response["currency"] == "usd", "currency_mismatch", path)
                need(response.get("protocol", {}).get("version") == REVISION, "response_revision_mismatch", path)
                expected_status = {"create": "ready_for_payment", "cancel": "canceled", "complete": "completed"}[base]
                need(response["status"] == expected_status, "checkout_state_mismatch", path)
                lines = response["line_items"]
                need(len(lines) == 1, "line_item_count", path)
                if len(lines) == 1:
                    line = lines[0]
                    need(
                        line["item"]["id"] == intent["item_id"]
                        and line.get("product_id") == intent["product_id"]
                        and line.get("variant_id") == intent["variant_id"],
                        "variant_binding_mismatch",
                        path,
                    )
                    need(
                        type(line["quantity"]) is int and line["quantity"] == 1 and line.get("unit_amount") == subtotal,
                        "line_price_mismatch",
                        path,
                    )
                    if base == "create":
                        need(
                            line.get("availability_status") in ("in_stock", "low_stock")
                            and type(line.get("available_quantity")) is int
                            and line["available_quantity"] >= 1,
                            "unavailable_line_item",
                            path,
                        )
                    totals(line["totals"], {"subtotal": subtotal, "total": subtotal}, path + "/line_totals")
                totals(response["totals"], expected, path + "/totals")
                need(
                    any(link["type"] == "return_policy" and _https(link["url"]) for link in response["links"]),
                    "return_policy_missing",
                    path,
                )
                if base == "complete":
                    order = response["order"]
                    order_id = order["id"]
                    need(bool(order_id) and order["checkout_session_id"] == session_id, "order_binding_mismatch", path)
                else:
                    need("order" not in response, "unexpected_order", path)
    except (KeyError, TypeError, ValueError, AttributeError, IndexError):
        issues.append({"code": "trace_contract_invalid", "path": "/"})
    return {
        "contract_version": CONTRACT,
        "status": "hold" if issues else "ready_for_sandbox_review",
        "protocol": "ACP",
        "revision": REVISION,
        "schema_provenance": provenance,
        "input_sha256": hashlib.sha256(json.dumps(trace, sort_keys=True, allow_nan=False).encode()).hexdigest(),
        "issues": issues[:100],
        "human_review_required": True,
        "execution": "not_performed",
        "live_behavior_verified": False,
        "settlement_verified": False,
        "limitations": [
            "Owner-supplied trace and catalog; no live availability proof.",
            "Quantity one, USD, no discounts; full refund handoff uses a merchant adapter, not an ACP refund endpoint.",
            "A successful handoff does not prove refund settlement or production readiness.",
        ],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("trace")
    parser.add_argument("--out")
    parser.add_argument("--strict", action="store_true")
    args = parser.parse_args()
    try:
        raw = Path(args.trace).read_bytes()
        if len(raw) > 2 * 1024 * 1024:
            raise ValueError("Trace exceeds 2 MiB")
        result = check_checkout(json.loads(raw))
    except (ValueError, OSError) as exc:
        result = {
            "contract_version": CONTRACT,
            "status": "hold",
            "error_type": type(exc).__name__,
            "execution": "not_performed",
            "human_review_required": True,
        }
    rendered = json.dumps(result, indent=2) + "\n"
    if args.out:
        Path(args.out).write_text(rendered, encoding="utf-8")
    print(rendered, end="")
    if args.strict and result["status"] != "ready_for_sandbox_review":
        raise SystemExit(1)


if __name__ == "__main__":
    main()
