"""Structural guardrails for headless enforcement payloads.

The engine checks the *shape* of a decision payload, not its subject matter. A
sanctions or compliance payload legitimately discusses human rights designations
and humanitarian exemptions, so no rule may key off free-text content.
"""

from __future__ import annotations

import json
from typing import Any

# Keys whose presence means the producer emitted a rendered document rather than
# a machine-consumable decision. Matched exactly, at the top level of the payload.
RENDERED_OUTPUT_KEYS = frozenset(
    {
        "markdown",
        "html",
        "rendered_memo",
        "rendered_markdown",
        "reviewer_checklist",
    }
)

MIN_BLOCK_CONFIDENCE = 0.8


class GuardrailViolation(Exception):
    pass


class GuardrailEngine:
    def __init__(self) -> None:
        self.rules = [self._rule_no_rendered_output, self._rule_confidence_threshold]

    def _rule_no_rendered_output(self, payload: dict) -> None:
        """Reject rendered documents, by key — never by scanning the text.

        The original rule raised on ``"human" in str(payload).lower()``, which
        rejected every payload whose text happened to contain the substring:
        "human rights sanctions" and "humanitarian exemption" are ordinary
        vocabulary in this domain, so the rule blocked the cases it exists to
        route.
        """
        found = sorted(RENDERED_OUTPUT_KEYS.intersection(payload))
        if found:
            raise GuardrailViolation(
                f"Payload carries rendered output ({', '.join(found)}). Must be a headless API payload."
            )

    def _rule_confidence_threshold(self, payload: dict) -> None:
        confidence = payload.get("confidence_score", 0)
        if not isinstance(confidence, (int, float)) or isinstance(confidence, bool):
            confidence = 0
        if payload.get("decision") == "BLOCK" and confidence < MIN_BLOCK_CONFIDENCE:
            raise GuardrailViolation(
                f"BLOCK decision must have confidence >= {MIN_BLOCK_CONFIDENCE}. Escalate instead."
            )

    def enforce(self, json_string: str) -> dict:
        try:
            payload: Any = json.loads(json_string)
        except json.JSONDecodeError as exc:
            raise GuardrailViolation("Output is not valid JSON.") from exc

        if not isinstance(payload, dict):
            raise GuardrailViolation("Output must be a JSON object.")

        for rule in self.rules:
            rule(payload)

        return payload
