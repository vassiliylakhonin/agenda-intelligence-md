"""SARIF rendering for evidence-packet diagnostics.

The renderer is intentionally independent from the CLI and GitHub Action. It
turns the stable evidence-packet response into SARIF 2.1.0 and locates each
claim in the original JSON text when that text is available.
"""

from __future__ import annotations

import json
import re
from typing import Any

SARIF_SCHEMA = "https://json.schemastore.org/sarif-2.1.0.json"

_RULES = {
    "no_source_reference": ("Claim has no source reference", "error"),
    "missing_source": ("Referenced source is missing", "error"),
    "quote_source_missing": ("Quoted source is missing", "error"),
    "quote_source_not_declared": ("Quoted source is not declared by the claim", "error"),
    "quote_absent": ("Declared quote is absent from its source", "error"),
    "lexical_support_polarity_mismatch": ("Claim and source disagree on negation", "warning"),
    "lexical_support_weak": ("Claim has weak lexical support", "warning"),
    "lexical_support_unsupported": ("Claim lacks lexical support", "warning"),
    "unmatched_numbers": ("Claim contains unmatched numeric facts", "warning"),
}


def _claim_line(input_text: str, claim_id: str) -> int:
    encoded = json.dumps(claim_id, ensure_ascii=False)
    match = re.search(r'"claim_id"\s*:\s*' + re.escape(encoded), input_text)
    return input_text.count("\n", 0, match.start()) + 1 if match else 1


def _rule_id(issue: str) -> str:
    return issue.split(":", 1)[0]


def render_evidence_packet_sarif(response: dict[str, Any], artifact_uri: str, input_text: str = "") -> dict:
    """Render evidence-packet issues as a SARIF 2.1.0 log."""
    rule_ids = sorted({_rule_id(issue) for claim in response.get("claims", []) for issue in claim.get("issues", [])})
    rules = []
    for rule_id in rule_ids:
        description, level = _RULES.get(rule_id, (rule_id.replace("_", " ").capitalize(), "warning"))
        rules.append(
            {
                "id": rule_id,
                "name": rule_id,
                "shortDescription": {"text": description},
                "defaultConfiguration": {"level": level},
            }
        )

    results = []
    for claim in response.get("claims", []):
        claim_id = str(claim.get("claim_id", "unknown"))
        for issue in claim.get("issues", []):
            rule_id = _rule_id(issue)
            description, level = _RULES.get(rule_id, (rule_id.replace("_", " ").capitalize(), "warning"))
            detail = issue.split(":", 1)[1] if ":" in issue else ""
            message = f"Claim {claim_id}: {description}."
            if detail:
                message = f"{message[:-1]} ({detail})."
            results.append(
                {
                    "ruleId": rule_id,
                    "level": level,
                    "message": {"text": message},
                    "locations": [
                        {
                            "physicalLocation": {
                                "artifactLocation": {"uri": artifact_uri},
                                "region": {"startLine": _claim_line(input_text, claim_id)},
                            }
                        }
                    ],
                    "properties": {
                        "claim_id": claim_id,
                        "packet_status": claim.get("packet_status"),
                        "lexical_coverage": (claim.get("lexical_support") or {}).get("coverage"),
                    },
                }
            )

    return {
        "$schema": SARIF_SCHEMA,
        "version": "2.1.0",
        "runs": [
            {
                "tool": {
                    "driver": {
                        "name": "Agenda Intelligence Evidence Linter",
                        "informationUri": "https://github.com/vassiliylakhonin/agenda-intelligence-md",
                        "rules": rules,
                    }
                },
                "results": results,
            }
        ],
    }


__all__ = ["render_evidence_packet_sarif"]
