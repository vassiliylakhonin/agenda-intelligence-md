"""Explicit, opt-in arithmetic certificates, never an automatic number search.

A caller declares each operand and its exact source excerpt. Arithmetic equality
is not semantic support: units, entities, periods and the chosen operation still
need a human review. No model or external retrieval is used.
"""

from __future__ import annotations

import re
from decimal import Decimal, InvalidOperation, localcontext

from agenda_intelligence.grounding import _numeric_mentions

_DECIMAL = re.compile(r"-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?\Z")
_NUMBER = re.compile(r"(?<![\w.,])-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?!\w|[.,][0-9])")


def _value(text: str) -> Decimal:
    if len(text) > 80 or not _DECIMAL.fullmatch(text):
        raise ValueError("Use a bounded plain decimal string, without separators or exponents.")
    return Decimal(text)


def _contains_number(text: str, value: Decimal) -> bool:
    return any(_value(match[0]) == value for match in _NUMBER.finditer(text) if len(match[0]) <= 80)


def check_derivations(claim: dict, sources: dict, *, enabled: bool) -> tuple[list[dict], set[str]]:
    """Return audit checks and exact unmatched-number display strings to discharge."""
    checks: list[dict] = []
    accepted: set[str] = set()
    for derivation in claim.get("derivations", []):
        check = {"value": derivation["value"], "operation": derivation["operation"], "status": "invalid"}
        checks.append(check)
        if not enabled:
            check["reason"] = "derived_numbers_disabled"
            continue
        try:
            target = _value(derivation["value"])
            operands = derivation["operands"]
            values = []
            unit = operands[0]["unit"]
            if any(operand["unit"] != unit for operand in operands):
                raise ValueError("operand_units_differ")
            for operand in operands:
                source_id = operand["source_id"]
                if source_id not in claim.get("source_ids", []) or source_id not in sources:
                    raise ValueError("operand_source_not_declared")
                excerpt = operand["quote"]
                if excerpt not in sources[source_id]["text"]:
                    raise ValueError("operand_quote_not_verbatim")
                value = _value(operand["value"])
                expected = {item["key"] for item in _numeric_mentions(f"{operand['value']} {unit}")}
                actual = {item["key"] for item in _numeric_mentions(excerpt)}
                if (
                    not _contains_number(excerpt, value)
                    or unit.casefold() not in excerpt.casefold()
                    or not expected.issubset(actual)
                ):
                    raise ValueError("operand_value_or_unit_absent_from_quote")
                values.append(value)
            if not _contains_number(claim["text"], target):
                raise ValueError("result_absent_from_claim")
            operation = derivation["operation"]
            if operation != "sum" and len(values) != 2:
                raise ValueError("operation_requires_two_operands")
            if operation == "percent_change":
                if not any(token in claim["text"].casefold() for token in ("%", "percent", "per cent", "процент")):
                    raise ValueError("percent_unit_absent_from_claim")
            elif unit.casefold() not in claim["text"].casefold():
                raise ValueError("result_unit_absent_from_claim")
            with localcontext() as context:
                context.prec = 200
                if operation == "sum":
                    result = sum(values, Decimal(0))
                elif operation == "difference":
                    result = values[0] - values[1]
                else:
                    if values[0] == 0:
                        raise ValueError("zero_percent_baseline")
                    result = (values[1] - values[0]) / abs(values[0]) * 100
                # No implicit rounding or tolerance, including repeating decimals.
                if operation == "percent_change":
                    equal = target * abs(values[0]) == (values[1] - values[0]) * 100
                else:
                    equal = target == result
                if not equal:
                    raise ValueError("arithmetic_mismatch")
            check["status"] = "arithmetic_consistent"
            check["reason"] = "human_must_check_entities_periods_units_and_operation"
            result_text = (
                f"{derivation['value']}%" if operation == "percent_change" else f"{derivation['value']} {unit}"
            )
            expected_keys = {item["key"] for item in _numeric_mentions(result_text)}
            mentions = _numeric_mentions(claim["text"])
            for display in (derivation["value"], derivation["value"] + "%"):
                occurrences = [item for item in mentions if item["display"] == display]
                if occurrences and all(item["key"] in expected_keys for item in occurrences):
                    accepted.add(display)
        except (ValueError, InvalidOperation) as error:
            check["reason"] = str(error)
    return checks, accepted
