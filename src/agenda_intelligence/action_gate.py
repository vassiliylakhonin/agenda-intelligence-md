"""Request-bound integration gate over Vizier and its existing human reviews.

The caller owns authenticated identity, dispatch and the persistent replay store.
Caller-supplied authority or an offline policy JSON file never authorizes execution.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import math
import sqlite3
import time
import urllib.parse
import urllib.request
from datetime import datetime
from pathlib import Path
from typing import Any, Callable

from agenda_intelligence.human_review import (
    HumanReviewClient,
    canonical_bytes,
    normalize_request,
    request_hash,
)


class ActionGateError(ValueError):
    """The integration must stop before dispatch."""


def _require(condition: bool, code: str) -> None:
    if not condition:
        raise ActionGateError(code)


def _expiry(value: Any) -> float:
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        _require(parsed.tzinfo is not None, "delegation_expiry_invalid")
        return parsed.timestamp()
    except (AttributeError, TypeError, ValueError) as exc:
        raise ActionGateError("delegation_expiry_invalid") from exc


def check_action_binding(request: dict, policy: dict, context: dict, *, now: float | None = None) -> dict:
    """Diagnostic checks only. ``context`` comes from trusted authentication middleware.

    The policy must be obtained from the configured Vizier transport by the
    integration. An offline diagnostic cannot establish that provenance.
    """
    now = time.time() if now is None else now
    try:
        _require(set(context) == {"principal", "agent", "tenant"}, "trusted_context_invalid")
        _require(all(isinstance(v, str) and v.strip() for v in context.values()), "trusted_context_invalid")
        _require(
            set(request) == {"principal", "agent", "action", "authority", "context", "grant"}, "request_fields_invalid"
        )
        _require(request["principal"]["id"] == context["principal"], "principal_mismatch")
        _require(request["agent"]["id"] == context["agent"], "agent_mismatch")
        action, authority = request["action"], request["authority"]
        _require(action["parameters"].get("tenant") == context["tenant"], "tenant_mismatch")
        _require(isinstance(request["grant"], str) and 0 < len(request["grant"]) <= 8192, "signed_grant_required")
        _require(action["type"] in authority["allowed_actions"], "action_out_of_scope")
        constraints = authority["constraints"]
        _require(action["target"] in constraints.get("allowed_targets", []), "target_out_of_scope")
        _require(action["target"] not in constraints.get("blocked_targets", []), "target_blocked")
        if "max_amount" in constraints:
            amount = action["parameters"].get("amount")
            maximum = constraints["max_amount"]
            _require(type(amount) in (int, float) and math.isfinite(amount) and amount >= 0, "amount_invalid")
            _require(
                type(maximum) in (int, float) and math.isfinite(maximum) and 0 <= amount <= maximum,
                "amount_out_of_scope",
            )
        if "currency" in constraints:
            _require(action["parameters"].get("currency") == constraints["currency"], "currency_mismatch")
        _require(policy["decision"] == "ALLOW", "vizier_did_not_allow")
        receipt = policy["receipt"]
        digest = hashlib.sha256(canonical_bytes(request)).hexdigest()
        _require(receipt["request_hash"] == digest and receipt["decision"] == "ALLOW", "receipt_binding_mismatch")
        _require(receipt["authority_provenance"] == "principal_signed", "signed_authority_unverified")
        grant = receipt["grant"]
        _require(
            grant["issuer"] == context["principal"] and grant["subject"] == context["agent"],
            "delegation_identity_mismatch",
        )
        _require(isinstance(grant["jti"], str) and 0 < len(grant["jti"]) <= 256, "delegation_id_invalid")
        _require(_expiry(grant["expires_at"]) > now, "delegation_expired")
        created = _expiry(receipt["created_at"])
        _require(now - 60 <= created <= now + 5, "policy_receipt_stale")
        _require(isinstance(receipt["id"], str) and bool(receipt["id"]), "receipt_id_invalid")
        results = policy["policy_results"]
        _require(bool(results) and all(row["result"] == "PASS" for row in results), "policy_checks_not_passed")
        _require(receipt["policy_rule_ids"] == [row["rule_id"] for row in results], "policy_rule_binding_mismatch")
        reasons = [row["reason_code"] for row in results if row.get("reason_code") is not None]
        _require(policy["reason_codes"] == receipt["reason_codes"] == reasons, "policy_reason_binding_mismatch")
        _require(
            type(policy["risk_score"]) in (int, float)
            and 0 <= policy["risk_score"] <= 1
            and receipt["risk_score"] == policy["risk_score"],
            "policy_risk_binding_mismatch",
        )
    except (KeyError, TypeError, AttributeError) as exc:
        raise ActionGateError("invalid_request_or_policy_contract") from exc
    return {
        "contract_version": "action-binding.v1",
        "decision": "human_review_required",
        "request_sha256": digest,
        "receipt_id": receipt["id"],
        "delegation": copy.deepcopy(grant),
        "human_review_required": True,
        "execution": "not_performed",
        "diagnostic_only": True,
        "valid_until_epoch": min(created + 60, _expiry(grant["expires_at"])),
    }


class ReplayStore:
    """Durable, cross-process one-use grant reservation, before external dispatch.

    Failure after reservation consumes the grant. This does not provide atomic
    exactly-once execution across a database and a remote system.
    """

    def __init__(self, path: str | Path):
        self.path = str(path)
        _require(self.path != ":memory:", "persistent_replay_store_required")
        with sqlite3.connect(self.path, timeout=5) as connection:
            connection.execute(
                "CREATE TABLE IF NOT EXISTS used_grants (identity TEXT PRIMARY KEY, used_at REAL NOT NULL)"
            )

    def reserve(self, issuer: str, grant_id: str) -> None:
        identity = hashlib.sha256(canonical_bytes([issuer, grant_id])).hexdigest()
        try:
            with sqlite3.connect(self.path, timeout=5) as connection:
                connection.execute("INSERT INTO used_grants VALUES (?, ?)", (identity, time.time()))
        except sqlite3.IntegrityError as exc:
            raise ActionGateError("delegation_replayed") from exc
        except sqlite3.Error as exc:
            raise ActionGateError("replay_store_unavailable") from exc


class _NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, req: Any, fp: Any, code: int, msg: str, headers: Any, newurl: str) -> None:
        return None


class VizierPolicyClient:
    """TLS-authenticated policy transport; rejects redirects and oversized responses."""

    def __init__(self, origin: str, api_key: str):
        parsed = urllib.parse.urlsplit(origin)
        _require(
            parsed.scheme == "https"
            and bool(parsed.hostname)
            and not parsed.username
            and not parsed.password
            and parsed.path in ("", "/")
            and not parsed.query
            and not parsed.fragment,
            "trusted_vizier_origin_invalid",
        )
        _require(bool(api_key) and "\r" not in api_key and "\n" not in api_key, "vizier_credential_required")
        self.origin, self.api_key = origin.rstrip("/"), api_key

    def verify(self, request: dict) -> dict:
        wire = canonical_bytes(request)
        _require(len(wire) <= 65536, "request_too_large")
        call = urllib.request.Request(
            self.origin + "/v1/verify",
            data=wire,
            method="POST",
            headers={
                "Content-Type": "application/json",
                "Authorization": "Bearer " + self.api_key,
                "User-Agent": "agenda-owner-action-gate/1",
            },
        )
        try:
            with urllib.request.build_opener(_NoRedirect()).open(call, timeout=10) as response:
                raw = response.read(262145)
                _require(len(raw) <= 262144, "policy_response_too_large")
                result = json.loads(raw)
                _require(isinstance(result, dict), "policy_response_invalid")
                return result
        except ActionGateError:
            raise
        except Exception as exc:
            raise ActionGateError("vizier_transport_failed") from exc


class GuardedActionExecutor:
    """The integration's sole dispatch seam for the supported action.

    Supply trusted transports, authenticated context and a protected shared
    ReplayStore. The dispatch callback must execute this exact frozen request.
    """

    def __init__(
        self,
        verify_policy: Callable[[dict], dict],
        reviews: HumanReviewClient,
        replay_store: ReplayStore,
        context: dict,
        audience: str,
    ):
        self.verify_policy, self.reviews, self.store = verify_policy, reviews, replay_store
        self.context, self.audience = copy.deepcopy(context), audience

    def execute(self, request: dict, approval: dict, dispatch: Callable[[dict], Any]) -> dict:
        frozen = json.loads(canonical_bytes(request))
        report = check_action_binding(frozen, self.verify_policy(copy.deepcopy(frozen)), self.context)
        _require(
            isinstance(approval, dict) and set(approval) == {"request", "review_id", "token"}, "human_approval_invalid"
        )
        review = normalize_request(approval["request"])
        _require(
            review["audience"] == self.audience and canonical_bytes(review["action"]) == canonical_bytes(frozen),
            "human_approval_request_mismatch",
        )
        # Verify locally before consuming either one-use record. claim() verifies
        # again and atomically consumes the authoritative Vizier approval.
        self.reviews.verify(review, approval["review_id"], approval["token"])
        grant = report["delegation"]
        self.store.reserve(grant["issuer"], grant["jti"])
        claimed = self.reviews.claim(review, approval["review_id"], approval["token"])
        _require(
            claimed.get("request_hash") == request_hash(review)
            and claimed.get("status") == "CONSUMED"
            and canonical_bytes(claimed.get("action")) == canonical_bytes(frozen),
            "human_approval_not_consumed",
        )
        _require(_expiry(grant["expires_at"]) > time.time(), "delegation_expired_before_dispatch")
        _require(report["valid_until_epoch"] > time.time(), "policy_expired_before_dispatch")
        result = dispatch(copy.deepcopy(frozen))
        return {
            **report,
            "diagnostic_only": False,
            "execution": "dispatched",
            "human_review_consumed": True,
            "result": result,
        }


def main() -> None:
    """Offline diagnostics deliberately cannot grant permission to dispatch."""
    parser = argparse.ArgumentParser(description="Check request/receipt bindings; never execute an action")
    parser.add_argument("input", help="JSON with request, policy and trusted context snapshots")
    parser.add_argument("--out")
    args = parser.parse_args()
    try:
        raw = Path(args.input).read_bytes()
        _require(len(raw) <= 1048576, "input_too_large")
        snapshot = json.loads(raw)
        result = check_action_binding(snapshot["request"], snapshot["policy"], snapshot["context"])
    except (ValueError, KeyError, TypeError, OSError) as exc:
        result = {
            "contract_version": "action-binding.v1",
            "decision": "hold",
            "diagnostic_only": True,
            "execution": "not_performed",
            "human_review_required": True,
            "error_type": type(exc).__name__,
        }
        if isinstance(exc, ActionGateError):
            result["error"] = str(exc)
    rendered = json.dumps(result, indent=2) + "\n"
    if args.out:
        Path(args.out).write_text(rendered, encoding="utf-8")
    print(rendered, end="")
    if result["decision"] == "hold":
        raise SystemExit(1)


if __name__ == "__main__":
    main()
