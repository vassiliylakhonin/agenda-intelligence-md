"""Post-hoc quality checks for agenda memo outputs.

This is intentionally separate from ``agenda-memo.schema.json``. The schema
checks shape; this module checks a small set of semantic guardrails that should
hold for evidence-readiness memos.
"""

from __future__ import annotations

import re
from typing import Any

from agenda_intelligence.evidence_mode import check_evidence_mode_discipline

GENERIC_MONITORING = re.compile(r"\b(monitor developments|stay informed|keep watching|continue to monitor)\b", re.I)
OVERREACH = re.compile(
    r"\b("
    r"legally approved|compliance approved|approved to proceed|cleared|sanctions safe|"
    r"no sanctions risk|compliant|transaction authorized|safe to repeat externally"
    r")\b",
    re.I,
)
GAP_LANGUAGE = re.compile(r"\b(gap|missing|unsupported|unknown|not evidenced|not decision ready|human review)\b", re.I)


def _strings(value: Any) -> list[str]:
    if isinstance(value, str):
        return [value]
    if isinstance(value, list):
        out: list[str] = []
        for item in value:
            out.extend(_strings(item))
        return out
    if isinstance(value, dict):
        out = []
        for item in value.values():
            out.extend(_strings(item))
        return out
    return []


def _blob(memo: dict[str, Any]) -> str:
    return "\n".join(_strings(memo))


def check_memo_quality(memo: dict[str, Any]) -> dict[str, Any]:
    """Return quality guardrail result for a schema-valid memo.

    The result shape is ``{"ok": bool, "errors": list[str], "passed": list[str]}``.
    These checks are deliberately conservative: they do not grade factual
    accuracy, but they reject memos that are structurally valid yet unsafe or
    weak as evidence-readiness output.
    """

    errors: list[str] = []
    passed: list[str] = []
    text = _blob(memo)

    evidence_mode = check_evidence_mode_discipline(memo)
    if evidence_mode["ok"]:
        passed.append("evidence_mode_discipline")
    else:
        errors.extend(f"evidence_mode_discipline: {error}" for error in evidence_mode["errors"])

    if OVERREACH.search(text):
        errors.append("memo uses approval/clearance/compliance overreach language")
    else:
        passed.append("no_approval_or_clearance_overreach")

    analysis = memo.get("analysis") or {}
    unknowns = analysis.get("unknowns") or []
    if unknowns and not GAP_LANGUAGE.search(text):
        errors.append("memo has unknowns but does not surface gaps/missing evidence in reader-facing text")
    else:
        passed.append("gaps_visible_when_unknowns_exist")

    recommended_actions = memo.get("recommended_actions") or []
    if not recommended_actions:
        errors.append("memo has no recommended_actions owner-action surface")
    for idx, action in enumerate(recommended_actions):
        action_text = str(action.get("action", ""))
        if GENERIC_MONITORING.search(action_text):
            errors.append(f"recommended_actions[{idx}] is generic monitoring, not an owner action")
        if not action.get("trigger") and not action.get("time_horizon"):
            errors.append(f"recommended_actions[{idx}] lacks trigger or time_horizon")
    if recommended_actions and not any(error.startswith("recommended_actions") for error in errors):
        passed.append("owner_actions_are_actionable")

    watch_next = memo.get("watch_next") or []
    for idx, item in enumerate(watch_next):
        indicator = str(item.get("indicator", ""))
        if GENERIC_MONITORING.search(indicator):
            errors.append(f"watch_next[{idx}] is generic, not an observable indicator")
        if not item.get("trigger") and not item.get("source_type"):
            errors.append(f"watch_next[{idx}] lacks trigger or source_type")
    if watch_next and not any(error.startswith("watch_next") for error in errors):
        passed.append("watch_next_is_observable")

    if unknowns:
        action_blob = "\n".join(_strings(recommended_actions) + _strings(watch_next))
        if not GAP_LANGUAGE.search(action_blob):
            errors.append("unknowns are not connected to recommended actions or watch indicators")
        else:
            passed.append("unknowns_connected_to_actions")

    return {"ok": not errors, "errors": errors, "passed": passed}
