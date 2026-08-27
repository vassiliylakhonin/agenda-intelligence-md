import json


class GuardrailViolation(Exception):
    pass


class GuardrailEngine:
    def __init__(self):
        self.rules = [
            self._rule_no_human_review,
            self._rule_confidence_threshold
        ]

    def _rule_no_human_review(self, payload: dict):
        if "markdown" in payload or "human" in str(payload).lower():
            raise GuardrailViolation("Payload contains human-readable/markdown output. Must be headless API payload.")

    def _rule_confidence_threshold(self, payload: dict):
        if payload.get("decision") == "BLOCK" and payload.get("confidence_score", 0) < 0.8:
            raise GuardrailViolation("BLOCK decision must have >0.8 confidence. Escalate instead.")

    def enforce(self, json_string: str):
        try:
            payload = json.loads(json_string)
        except json.JSONDecodeError:
            raise GuardrailViolation("Output is not valid JSON.")

        for rule in self.rules:
            rule(payload)

        return payload
