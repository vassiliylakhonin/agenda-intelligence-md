"""Generate a simulated merchant trace; no network, payment or real refund."""

import argparse
import copy
import json
from datetime import datetime, timezone
from pathlib import Path

from agenda_intelligence.checkout_check import REVISION, check_checkout


def build_trace():
    """Owner simulator, not a merchant integration or a live behavior claim."""
    snapshot = {
        "observed_at": datetime.now(timezone.utc).isoformat(),
        "item_id": "sandbox-shirt-blue-m",
        "product_id": "sandbox-shirt",
        "variant_id": "blue-m",
        "currency": "usd",
        "unit_amount": 2000,
        "available_quantity": 5,
        "tax_amount": 100,
        "fulfillment_amount": 300,
        "refund_handoff_url": "https://merchant.example/sandbox/refund-requests",
    }
    trace = {
        "protocol": "ACP",
        "revision": REVISION,
        "simulation": True,
        "merchant_snapshot": snapshot,
        "intent": {k: snapshot[k] for k in ("item_id", "product_id", "variant_id", "currency", "unit_amount")},
        "exchanges": [],
    }
    trace["intent"]["quantity"] = 1

    def totals(values):
        return [{"type": kind, "display_text": kind, "amount": value} for kind, value in values.items()]

    cache = {}

    def exchange(branch, operation, request, response, session_id=None, url=None):
        key = branch + ":" + operation
        row = {
            "branch": branch,
            "operation": operation,
            "request": request,
            "response": response,
            "http_status": 200,
            "idempotency_key": key,
        }
        if session_id:
            row["session_id"] = session_id
        if url:
            row["url"] = url
        cache[key] = copy.deepcopy(row)
        trace["exchanges"].append(copy.deepcopy(row))

    def retry(branch, operation):
        row = copy.deepcopy(cache[branch + ":" + operation])
        row["operation"] = "retry_" + operation
        trace["exchanges"].append(row)

    for branch in ("cancel", "purchase"):
        session_id = "sandbox-session-" + branch
        response = {
            "id": session_id,
            "protocol": {"version": REVISION},
            "status": "ready_for_payment",
            "currency": "usd",
            "capabilities": {},
            "fulfillment_options": [],
            "messages": [],
            "links": [{"type": "return_policy", "url": "https://merchant.example/returns"}],
            "line_items": [
                {
                    "id": "line-1",
                    "item": {"id": snapshot["item_id"]},
                    "quantity": 1,
                    "product_id": snapshot["product_id"],
                    "variant_id": snapshot["variant_id"],
                    "unit_amount": 2000,
                    "availability_status": "in_stock",
                    "available_quantity": 5,
                    "totals": totals({"subtotal": 2000, "total": 2000}),
                }
            ],
            "totals": totals({"subtotal": 2000, "tax": 100, "fulfillment": 300, "total": 2400}),
        }
        exchange(
            branch,
            "create",
            {"line_items": [{"id": snapshot["item_id"]}], "currency": "usd", "capabilities": {}},
            response,
        )
        retry(branch, "create")
        if branch == "cancel":
            response["status"] = "canceled"
            exchange(branch, "cancel", {}, response, session_id)
            retry(branch, "cancel")
        else:
            response["status"] = "completed"
            response["order"] = {
                "id": "sandbox-order-1",
                "checkout_session_id": session_id,
                "permalink_url": "https://merchant.example/orders/sandbox-order-1",
                "status": "created",
            }
            exchange(
                branch,
                "complete",
                {
                    "payment_data": {
                        "handler_id": "sandbox-only",
                        "instrument": {
                            "type": "sandbox",
                            "credential": {"type": "sandbox", "token": "not-a-payment-token"},
                        },
                    }
                },
                response,
                session_id,
            )
            retry(branch, "complete")
            refund = {"order_id": "sandbox-order-1", "amount": 2400, "currency": "usd"}
            exchange(
                branch,
                "refund_handoff",
                refund,
                {**refund, "status": "accepted", "refund_id": "sandbox-refund-1"},
                url=snapshot["refund_handoff_url"],
            )
            retry(branch, "refund_handoff")
    return trace


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", default="checkout-sandbox-trace.json")
    args = parser.parse_args()
    trace = build_trace()
    Path(args.out).write_text(json.dumps(trace, indent=2) + "\n", encoding="utf-8")
    result = check_checkout(trace)
    print(json.dumps(result, indent=2))
    if result["issues"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
