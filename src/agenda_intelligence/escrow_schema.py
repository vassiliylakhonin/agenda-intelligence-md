"""Bounded, offline schema evaluation matching the Worker escrow contract."""

import json
import math
from typing import Any

from jsonschema import Draft202012Validator

ANNOTATIONS = {"title", "description", "$comment", "default", "examples", "$id"}
SCALAR_KEYWORDS = {
    "type",
    "required",
    "enum",
    "const",
    "minLength",
    "maxLength",
    "minItems",
    "maxItems",
    "minProperties",
    "maxProperties",
    "minimum",
    "maximum",
    "exclusiveMinimum",
    "exclusiveMaximum",
    "uniqueItems",
}
DIALECTS = {"https://json-schema.org/draft/2020-12/schema", "http://json-schema.org/draft-07/schema#"}


def validate_escrow_artifact(schema_input: Any, artifact: Any, has_artifact: bool = True) -> tuple[str, list[str]]:
    """Unknown keywords and references require review; they are never ignored or fetched."""
    budget = [10000]

    def inspect(schema: Any, depth: int = 0) -> None:
        budget[0] -= 1
        if budget[0] < 0 or depth > 64:
            raise ValueError("Schema validation complexity limit exceeded")
        if isinstance(schema, bool):
            return
        if not isinstance(schema, dict):
            raise ValueError("Schema must be an object or boolean")
        for key, value in schema.items():
            if key in ANNOTATIONS or key in SCALAR_KEYWORDS:
                continue
            if key == "$schema":
                if value not in DIALECTS:
                    raise ValueError("Unsupported schema dialect")
            elif key == "properties":
                if not isinstance(value, dict):
                    raise ValueError("Invalid properties object")
                for child in value.values():
                    inspect(child, depth + 1)
            elif key in {"items", "additionalProperties", "not"}:
                inspect(value, depth + 1)
            elif key in {"allOf", "anyOf", "oneOf"}:
                if not isinstance(value, list) or not value:
                    raise ValueError(f"Invalid {key}")
                for child in value:
                    inspect(child, depth + 1)
            else:
                raise ValueError(f"Unsupported schema keyword: {key}")

    try:
        schema = json.loads(schema_input) if isinstance(schema_input, str) else schema_input

        def tree_size(value: Any, depth: int = 0) -> int:
            budget[0] -= 1
            if budget[0] < 0 or depth > 64:
                raise ValueError("Schema validation complexity limit exceeded")
            if isinstance(value, (int, float)) and not isinstance(value, bool):
                if not math.isfinite(value) or abs(value) > 9007199254740991:
                    raise ValueError("Numbers outside the interoperable safe range require review")
            children = value.values() if isinstance(value, dict) else value if isinstance(value, list) else []
            return 1 + sum(tree_size(child, depth + 1) for child in children)

        document = [schema, artifact if has_artifact else None]
        encoded = json.dumps(document, ensure_ascii=False, allow_nan=False, separators=(",", ":")).encode("utf-8")
        if len(encoded) > 65536 or tree_size(schema) * tree_size(document[1]) > 10000:
            raise ValueError("Schema validation complexity limit exceeded")
        inspect(schema)
        Draft202012Validator.check_schema(schema)
        if not has_artifact:
            raise ValueError("Artifact data is required for schema validation; a hash is insufficient")
        validator = Draft202012Validator(schema)
        if not validator.is_valid(artifact):
            return "invalid", ["Artifact does not satisfy expected_schema"]
        return "valid", []
    except Exception as exc:
        return "unverified", [str(exc).splitlines()[0]]
