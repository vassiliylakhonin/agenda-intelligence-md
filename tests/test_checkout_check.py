"""One merchant scenario with schema and transactional regression failures."""

import importlib.util
from pathlib import Path

import pytest

from agenda_intelligence.checkout_check import check_checkout

EXAMPLE = Path(__file__).resolve().parents[1] / "examples/agent-checkout-readiness/run.py"
spec = importlib.util.spec_from_file_location("checkout_sandbox", EXAMPLE)
sandbox = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sandbox)


def test_sandbox_golden_uses_pinned_official_schema():
    result = check_checkout(sandbox.build_trace())
    assert result["issues"] == []
    assert result["status"] == "ready_for_sandbox_review"
    assert result["schema_provenance"]["sha256"] == "d0e4290617d66bf05d002b8ace388732be2b3eb9a92a1003db7a2daa1e0436f2"
    assert result["execution"] == "not_performed" and result["settlement_verified"] is False


@pytest.mark.parametrize(
    "failure,code",
    [
        ("stale", "stale_snapshot"),
        ("price", "catalog_mismatch"),
        ("variant", "variant_binding_mismatch"),
        ("stock", "out_of_stock"),
        ("duplicate-session", "retry_changed_result"),
        ("total", "total_mismatch"),
        ("cancel", "checkout_state_mismatch"),
        ("refund-order", "refund_request_mismatch"),
        ("duplicate-refund", "retry_changed_result"),
        ("duplicate-order", "retry_changed_result"),
        ("schema", "acp_schema_invalid"),
        ("missing-step", "scenario_sequence_incomplete"),
        ("key-collision", "idempotency_key_collision"),
    ],
)
def test_checkout_failures_are_held(failure, code):
    trace = sandbox.build_trace()
    rows = trace["exchanges"]
    if failure == "stale":
        trace["merchant_snapshot"]["observed_at"] = "2020-01-01T00:00:00Z"
    elif failure == "price":
        trace["intent"]["unit_amount"] = 1
    elif failure == "variant":
        rows[0]["response"]["line_items"][0]["variant_id"] = "red-l"
    elif failure == "stock":
        trace["merchant_snapshot"]["available_quantity"] = 0
    elif failure == "duplicate-session":
        rows[1]["response"]["id"] = "second-session"
    elif failure == "total":
        rows[0]["response"]["totals"][-1]["amount"] = 2399
    elif failure == "cancel":
        rows[2]["response"]["status"] = "completed"
    elif failure == "refund-order":
        rows[8]["request"]["order_id"] = "other-order"
    elif failure == "duplicate-refund":
        rows[9]["response"]["refund_id"] = "second-refund"
    elif failure == "duplicate-order":
        rows[7]["response"]["order"]["id"] = "second-order"
    elif failure == "schema":
        rows[0]["request"]["line_items"][0]["quantity"] = 1
    elif failure == "missing-step":
        rows.pop()
    else:
        rows[4]["idempotency_key"] = rows[0]["idempotency_key"]
    result = check_checkout(trace)
    assert result["status"] == "hold"
    assert code in {issue["code"] for issue in result["issues"]}


@pytest.mark.parametrize("trace", [{}, [], {"protocol": "ACP"}])
def test_malformed_trace_fails_closed(trace):
    assert check_checkout(trace)["status"] == "hold"
