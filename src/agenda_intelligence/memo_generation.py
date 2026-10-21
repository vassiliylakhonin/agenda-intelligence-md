"""Optional, bounded Anthropic memo generation; local validators own acceptance."""

from __future__ import annotations

import json
import os
from importlib import resources
from typing import Any, Optional


class MemoGenerationError(Exception):
    """A redacted diagnostic, distinct from absent optional model configuration."""

    def __init__(self, code: str, message: str, *, invoked: bool = False):
        super().__init__(message)
        self.code = code
        self.invoked = invoked


def _limit(name: str, default: int) -> int:
    try:
        value = int(os.environ.get(name, str(default)))
        if value <= 0:
            raise ValueError
        return value
    except ValueError:
        raise MemoGenerationError("generation_configuration_invalid", f"{name} must be a positive integer.") from None


def generation_schema() -> dict[str, Any]:
    """Copy the public schema, excluding audit fields owned by the server."""
    path = resources.files("agenda_intelligence") / "data/schemas/v1/agenda-memo.schema.json"
    schema = json.loads(path.read_text(encoding="utf-8"))
    for key in ["$schema", "$id", "examples", "x-schema-version"]:
        schema.pop(key, None)
    audit = schema["properties"]["audit"]["properties"]
    for key in ["machine_verified", "validation_details", "self_assessed_score", "reasoning_memory"]:
        audit.pop(key)
    return schema


def generate_memo(system_prompt: str, user_message: str) -> Optional[str]:
    """Return complete JSON text, or None only when the optional SDK/key is absent.

    Count tokens before generation; never truncate evidence or retry generation.
    No protected tool is made available to the model.
    """
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        return None
    try:
        import anthropic
    except ImportError:
        return None
    if not hasattr(anthropic, "transform_schema"):
        raise MemoGenerationError(
            "generation_sdk_unsupported", "Install agenda-intelligence-md[llm] with anthropic>=0.84."
        )

    output_limit = _limit("AGENDA_INTELLIGENCE_MAX_TOKENS", 4096)
    context_limit = _limit("AGENDA_INTELLIGENCE_CONTEXT_TOKENS", 200000)
    byte_limit = _limit("AGENDA_INTELLIGENCE_MAX_INPUT_BYTES", 1048576)
    if output_limit > context_limit:
        raise MemoGenerationError("generation_budget_exceeded", "Output budget exceeds the configured context budget.")
    schema = anthropic.transform_schema(generation_schema())
    output_config = {"format": {"type": "json_schema", "schema": schema}}
    request: dict[str, Any] = {
        "model": os.environ.get("AGENDA_INTELLIGENCE_MODEL", "claude-opus-4-7"),
        "system": system_prompt,
        "messages": [{"role": "user", "content": user_message}],
        "output_config": output_config,
    }
    if len(json.dumps(request, ensure_ascii=False).encode("utf-8")) > byte_limit:
        raise MemoGenerationError(
            "generation_budget_exceeded", "Serialized model input exceeds the configured byte budget."
        )

    with anthropic.Anthropic(api_key=api_key, max_retries=0, timeout=60.0) as client:
        try:
            counted = client.messages.count_tokens(**request)
        except anthropic.APIError:
            raise MemoGenerationError(
                "generation_token_count_failed", "Token preflight failed; generation was not started."
            ) from None
        tokens = counted.input_tokens
        if type(tokens) is not int or tokens < 0:
            raise MemoGenerationError("generation_token_count_failed", "Token preflight returned an invalid count.")
        if tokens + output_limit > context_limit:
            raise MemoGenerationError(
                "generation_budget_exceeded", "Input plus reserved output exceeds the context budget."
            )
        try:
            response = client.messages.create(max_tokens=output_limit, **request)
        except anthropic.APIError:
            raise MemoGenerationError(
                "generation_provider_error", "Model request failed; no retry was performed.", invoked=True
            ) from None
    if response.stop_reason != "end_turn":
        code = {"max_tokens": "generation_truncated", "refusal": "generation_refused"}.get(
            response.stop_reason, "generation_incomplete"
        )
        raise MemoGenerationError(code, "Model did not return a complete memo.", invoked=True)
    if len(response.content) != 1 or response.content[0].type != "text" or not response.content[0].text.strip():
        raise MemoGenerationError("generation_invalid_output", "Expected one nonempty JSON text block.", invoked=True)
    return response.content[0].text
