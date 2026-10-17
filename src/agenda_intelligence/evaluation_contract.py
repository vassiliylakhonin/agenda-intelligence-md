"""Advisory routing metadata; never grants authority or changes domain findings."""

BLOCK = {"block", "reject", "stop", "no_go", "block_until_verified", "block_unsafe_claims", "REFUND_TO_BUYER"}
INSUFFICIENT = {"insufficient_information", "not_decision_ready", "pause_for_evidence", "request_evidence"}


def evaluation_contract(response: dict) -> dict:
    value = response.get("financial_guard_verdict") or response.get("arbitration_ruling") or response
    routes = [value.get(key) for key in ("verdict", "decision", "gate_decision", "triage_recommendation", "ruling")]
    operational = value.get("operational_decision")
    if isinstance(operational, dict):
        routes.append(operational.get("decision"))
    blocked = any(isinstance(route, str) and route in BLOCK for route in routes) or bool(value.get("violations"))
    gaps = value.get("evidence_gaps") or value.get("blocking_gaps") or []
    insufficient = bool(gaps) or any(isinstance(route, str) and route in INSUFFICIENT for route in routes)
    for item in value.get("results", []):
        child = item.get("response") if isinstance(item, dict) else None
        if isinstance(child, dict):
            action = evaluation_contract(child)["next_action"]
            blocked = blocked or action == "block"
            insufficient = insufficient or action == "insufficient"
        else:
            insufficient = True
    action = "block" if blocked else "insufficient" if insufficient else "review"
    score_kind = (
        "risk"
        if "financial_guard_verdict" in response
        else (
            "evidence_readiness"
            if any(isinstance(value.get(key), (int, float)) for key in ("decision_readiness_score", "readiness_score"))
            else "not_scored"
        )
    )
    return {
        "next_action": action,
        "decision_kind": "evidence_review",
        "authorization_granted": False,
        "score_kind": score_kind,
    }


def with_evaluation_contract(response: dict) -> dict:
    return {**response, **evaluation_contract(response)}
