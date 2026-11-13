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


def _value(text: str) -> Decimal:
    if len(text) > 80 or not _DECIMAL.fullmatch(text):
        raise ValueError("Use a bounded plain decimal string, without separators or exponents.")
    return Decimal(text)


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
            operation = derivation["operation"]
            if operation not in ("product", "quotient") and any(operand["unit"] != unit for operand in operands):
                raise ValueError("operand_units_differ")
            for operand in operands:
                source_id = operand["source_id"]
                if source_id not in claim.get("source_ids", []) or source_id not in sources:
                    raise ValueError("operand_source_not_declared")
                excerpt = operand["quote"]
                if excerpt not in sources[source_id]["text"]:
                    raise ValueError("operand_quote_not_verbatim")
                value = _value(operand["value"])
                expected = {item["key"] for item in _numeric_mentions(f"{operand['value']} {operand['unit']}")}
                actual = {item["key"] for item in _numeric_mentions(excerpt)}
                if not expected.issubset(actual) or (
                    all(key.startswith("numnumber-") for key in expected)
                    and operand["unit"].casefold() not in excerpt.casefold()
                ):
                    raise ValueError("operand_value_or_unit_absent_from_quote")
                values.append(value)
            if operation in ("product", "quotient"):
                left, right = (operand["unit"] for operand in operands[:2])
                if operation == "product":
                    unit = right if left == "ratio" else left if right == "ratio" else f"{left}*{right}"
                else:
                    unit = "ratio" if left == right else left if right == "ratio" else f"{left}/{right}"
                if derivation.get("result_unit") != unit:
                    raise ValueError("result_unit_mismatch")
            result_text = (
                f"{derivation['value']}%"
                if operation in ("percent_change", "percent")
                else (f"{derivation['value']} {unit}")
            )
            expected_keys = {item["key"] for item in _numeric_mentions(result_text)}
            if not expected_keys.issubset({item["key"] for item in _numeric_mentions(claim["text"])}):
                raise ValueError("result_absent_from_claim")
            if operation != "sum" and len(values) != 2:
                raise ValueError("operation_requires_two_operands")
            if operation in ("percent_change", "percent"):
                if not any(token in claim["text"].casefold() for token in ("%", "percent", "per cent", "процент")):
                    raise ValueError("percent_unit_absent_from_claim")
            elif (
                all(key.startswith("numnumber-") for key in expected_keys)
                and unit.casefold() not in claim["text"].casefold()
            ):
                raise ValueError("result_unit_absent_from_claim")
            with localcontext() as context:
                context.prec = 200
                if operation == "sum":
                    result = sum(values, Decimal(0))
                elif operation == "difference":
                    result = values[0] - values[1]
                elif operation == "product":
                    result = values[0] * values[1]
                elif operation in ("quotient", "percent"):
                    if values[1] == 0:
                        raise ValueError("zero_divisor")
                    result = values[0] / values[1] * (100 if operation == "percent" else 1)
                else:
                    if values[0] == 0:
                        raise ValueError("zero_percent_baseline")
                    result = (values[1] - values[0]) / abs(values[0]) * 100
                # No implicit rounding or tolerance, including repeating decimals.
                if operation == "percent_change":
                    equal = target * abs(values[0]) == (values[1] - values[0]) * 100
                elif operation in ("quotient", "percent"):
                    equal = target * values[1] == values[0] * (100 if operation == "percent" else 1)
                else:
                    equal = target == result
                if not equal:
                    raise ValueError("arithmetic_mismatch")
            check["status"] = "arithmetic_consistent"
            check["derived_verified"] = True
            expression = " + ".join(operand["value"] for operand in operands)
            if operation == "difference":
                expression = f"({operands[0]['value']}) - ({operands[1]['value']})"
            elif operation == "product":
                expression = f"({operands[0]['value']}) * ({operands[1]['value']})"
            elif operation in ("quotient", "percent"):
                expression = f"({operands[0]['value']}) / ({operands[1]['value']})"
                if operation == "percent":
                    expression += " * 100"
            elif operation == "percent_change":
                expression = (
                    f"(({operands[1]['value']}) - ({operands[0]['value']}))" f" / abs({operands[0]['value']}) * 100"
                )
            check["formula"] = f"{expression} = {derivation['value']}"
            check["reason"] = "human_must_check_entities_periods_units_and_operation"
            mentions = _numeric_mentions(claim["text"])
            for display in {item["display"] for item in mentions if item["key"] in expected_keys}:
                occurrences = [item for item in mentions if item["display"] == display]
                if occurrences and all(item["key"] in expected_keys for item in occurrences):
                    accepted.add(display)
        except (ValueError, InvalidOperation) as error:
            check["reason"] = str(error)
    return checks, accepted
