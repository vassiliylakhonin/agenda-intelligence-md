"""Heuristic scoring for Agenda-Intelligence JSON briefs.

The scorer is intentionally modest: it measures structural quality and protocol
adherence signals, not factual truthfulness.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any


WEIGHTS = {
    "relevance": 25,
    "evidence_support": 25,
    "completeness": 20,
    "actionability": 15,
    "clarity": 15,
}

REQUIRED_FIELDS = [
    "bottom_line",
    "signal_classification",
    "what_changed",
    "main_uncertainty",
    "watch_next",
]

OPTIONAL_PROTOCOL_FIELDS = [
    "why_it_matters",
    "affected_actors",
    "scenarios",
    "evidence_mode",
    "confidence",
]

VAGUE_PHRASES = [
    "monitor developments",
    "complex landscape",
    "it remains to be seen",
    "stay tuned",
    "various stakeholders",
]


@dataclass(frozen=True)
class DimensionScore:
    score: int
    max_score: int
    feedback: str


def score_brief(brief: dict[str, Any]) -> dict[str, Any]:
    """Score a JSON agenda brief on the public 0-100 rubric shape."""
    dimensions = {
        "relevance": _score_relevance(brief),
        "evidence_support": _score_evidence_support(brief),
        "completeness": _score_completeness(brief),
        "actionability": _score_actionability(brief),
        "clarity": _score_clarity(brief),
    }
    total = sum(item.score for item in dimensions.values())
    return {
        "score": total,
        "max_score": 100,
        "dimensions": {
            name: {
                "score": item.score,
                "max_score": item.max_score,
                "feedback": item.feedback,
            }
            for name, item in dimensions.items()
        },
        "note": "Heuristic structural score; does not verify factual truthfulness.",
    }


def format_score(result: dict[str, Any]) -> str:
    """Format a score result for CLI output."""
    lines = [
        f"score: {result['score']}/{result['max_score']}",
        f"note: {result['note']}",
    ]
    for name, item in result["dimensions"].items():
        lines.append(
            f"{name}: {item['score']}/{item['max_score']} - {item['feedback']}"
        )
    return "\n".join(lines)


def _score_relevance(brief: dict[str, Any]) -> DimensionScore:
    score = 0
    feedback = []
    if _non_empty_text(brief.get("bottom_line")):
        score += 8
    if _non_empty_text(brief.get("what_changed")):
        score += 8
    if _non_empty_text(brief.get("why_it_matters")):
        score += 5
    if _non_empty_list(brief.get("affected_actors")):
        score += 4
    if score >= 21:
        feedback.append("clear topic, change, and affected actors")
    else:
        feedback.append("add why_it_matters and affected_actors for stronger relevance")
    return DimensionScore(
        score=min(score, WEIGHTS["relevance"]),
        max_score=25,
        feedback="; ".join(feedback),
    )


def _score_evidence_support(brief: dict[str, Any]) -> DimensionScore:
    evidence_mode = brief.get("evidence_mode")
    confidence = brief.get("confidence")
    score_by_mode = {
        "live_source_backed": 18,
        "mixed": 15,
        "user_provided": 13,
        "reasoning_only": 9,
    }
    score = score_by_mode.get(evidence_mode, 6)
    feedback = [f"evidence_mode={evidence_mode or 'missing'}"]

    if isinstance(confidence, dict) and confidence.get("reasoning"):
        score += 5
        feedback.append("confidence reasoning provided")
    elif confidence:
        score += 3
        feedback.append("confidence level provided")
    else:
        feedback.append("add confidence level or rationale")

    if evidence_mode in {"live_source_backed", "mixed", "user_provided"}:
        score += 2
    else:
        feedback.append("source-backed evidence would raise this score")

    return DimensionScore(
        score=min(score, WEIGHTS["evidence_support"]),
        max_score=25,
        feedback="; ".join(feedback),
    )


def _score_completeness(brief: dict[str, Any]) -> DimensionScore:
    required_hits = sum(1 for field in REQUIRED_FIELDS if _has_value(brief.get(field)))
    optional_hits = sum(
        1 for field in OPTIONAL_PROTOCOL_FIELDS if _has_value(brief.get(field))
    )
    score = round((required_hits / len(REQUIRED_FIELDS)) * 14)
    score += round((optional_hits / len(OPTIONAL_PROTOCOL_FIELDS)) * 6)
    missing = [field for field in REQUIRED_FIELDS if not _has_value(brief.get(field))]
    if missing:
        feedback = f"missing required fields: {', '.join(missing)}"
    else:
        feedback = (
            "all required fields present; optional fields present: "
            f"{optional_hits}/{len(OPTIONAL_PROTOCOL_FIELDS)}"
        )
    return DimensionScore(
        score=min(score, WEIGHTS["completeness"]),
        max_score=20,
        feedback=feedback,
    )


def _score_actionability(brief: dict[str, Any]) -> DimensionScore:
    watch_next = brief.get("watch_next")
    scenarios = brief.get("scenarios")
    score = 0
    if _non_empty_list(watch_next):
        score += 6
        score += min(len(watch_next), 3)
    if _non_empty_text(brief.get("main_uncertainty")):
        score += 2
    if isinstance(scenarios, list) and scenarios:
        scenario_with_indicators = any(
            _non_empty_list(item.get("indicators"))
            for item in scenarios
            if isinstance(item, dict)
        )
        score += 3 if scenario_with_indicators else 2
    if score >= 12:
        feedback = "watch-next indicators and scenarios are decision-useful"
    else:
        feedback = "add concrete watch_next items and scenario indicators"
    return DimensionScore(
        score=min(score, WEIGHTS["actionability"]),
        max_score=15,
        feedback=feedback,
    )


def _score_clarity(brief: dict[str, Any]) -> DimensionScore:
    text_parts = [str(value) for value in brief.values() if isinstance(value, str)]
    combined = " ".join(text_parts).lower()
    score = 15
    vague_hits = [phrase for phrase in VAGUE_PHRASES if phrase in combined]
    if vague_hits:
        score -= min(6, len(vague_hits) * 2)
    long_fields = [part for part in text_parts if len(part.split()) > 60]
    if long_fields:
        score -= min(4, len(long_fields) * 2)
    empty_strings = [
        key
        for key, value in brief.items()
        if isinstance(value, str) and not value.strip()
    ]
    if empty_strings:
        score -= min(4, len(empty_strings) * 2)
    feedback = "concise and readable"
    if vague_hits:
        feedback = f"avoid vague phrasing: {', '.join(vague_hits)}"
    elif long_fields:
        feedback = "some fields are long; tighten for brief readability"
    return DimensionScore(score=max(0, score), max_score=15, feedback=feedback)


def _has_value(value: Any) -> bool:
    if isinstance(value, str):
        return bool(value.strip())
    if isinstance(value, list):
        return bool(value)
    if isinstance(value, dict):
        return bool(value)
    return value is not None


def _non_empty_text(value: Any) -> bool:
    return isinstance(value, str) and bool(value.strip())


def _non_empty_list(value: Any) -> bool:
    return isinstance(value, list) and bool(value)
