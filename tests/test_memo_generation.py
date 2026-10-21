"""Exercise model request/response handling without credentials or external calls."""

import json
import sys
from types import SimpleNamespace

import pytest

from agenda_intelligence import memo_generation, product


class ProviderError(Exception):
    pass


@pytest.fixture
def sdk(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "offline-test-key")
    for name in [
        "AGENDA_INTELLIGENCE_MAX_TOKENS",
        "AGENDA_INTELLIGENCE_CONTEXT_TOKENS",
        "AGENDA_INTELLIGENCE_MAX_INPUT_BYTES",
        "AGENDA_INTELLIGENCE_MODEL",
    ]:
        monkeypatch.delenv(name, raising=False)
    state = SimpleNamespace(
        tokens=100,
        counted=[],
        created=[],
        clients=[],
        count_error=False,
        create_error=False,
        response=SimpleNamespace(stop_reason="end_turn", content=[SimpleNamespace(type="text", text="{}")]),
    )

    class Client:
        def __init__(self, **kwargs):
            state.clients.append(kwargs)
            self.messages = self

        def __enter__(self):
            return self

        def __exit__(self, *args):
            return False

        def count_tokens(self, **kwargs):
            state.counted.append(kwargs)
            if state.count_error:
                raise ProviderError("private provider detail")
            return SimpleNamespace(input_tokens=state.tokens)

        def create(self, **kwargs):
            state.created.append(kwargs)
            if state.create_error:
                raise ProviderError("private provider detail")
            return state.response

    monkeypatch.setitem(
        sys.modules,
        "anthropic",
        SimpleNamespace(Anthropic=Client, transform_schema=lambda schema: schema, APIError=ProviderError),
    )
    return state


def test_schema_is_sent_and_counted_before_one_bounded_generation(sdk):
    assert memo_generation.generate_memo("system", "user") == "{}"
    assert len(sdk.counted) == len(sdk.created) == 1
    assert sdk.created[0]["output_config"]["format"]["type"] == "json_schema"
    assert sdk.counted[0]["output_config"] == sdk.created[0]["output_config"]
    assert sdk.created[0]["max_tokens"] == 4096
    assert sdk.clients[0]["max_retries"] == 0
    schema = sdk.created[0]["output_config"]["format"]["schema"]
    assert "machine_verified" not in schema["properties"]["audit"]["properties"]
    assert "machine_verified" in product._load_schema("agenda-memo.schema.json")["properties"]["audit"]["properties"]


@pytest.mark.parametrize("limit,tokens,expected_calls", [(5000, 904, 1), (5000, 905, 0), (4000, 0, 0)])
def test_context_budget_reserves_output_without_truncating(sdk, monkeypatch, limit, tokens, expected_calls):
    monkeypatch.setenv("AGENDA_INTELLIGENCE_CONTEXT_TOKENS", str(limit))
    sdk.tokens = tokens
    if expected_calls:
        assert memo_generation.generate_memo("unchanged system", "unchanged evidence") == "{}"
        assert sdk.created[0]["messages"][0]["content"] == "unchanged evidence"
    else:
        with pytest.raises(memo_generation.MemoGenerationError, match="budget") as failure:
            memo_generation.generate_memo("system", "evidence")
        assert not failure.value.invoked
    assert len(sdk.created) == expected_calls


def test_byte_limit_prevents_even_token_count_request(sdk, monkeypatch):
    monkeypatch.setenv("AGENDA_INTELLIGENCE_MAX_INPUT_BYTES", "10")
    with pytest.raises(memo_generation.MemoGenerationError, match="byte budget"):
        memo_generation.generate_memo("system", "evidence")
    assert sdk.counted == sdk.created == sdk.clients == []


@pytest.mark.parametrize("value", ["0", "-1", "invalid"])
def test_invalid_budget_is_configuration_error_before_network(sdk, monkeypatch, value):
    monkeypatch.setenv("AGENDA_INTELLIGENCE_MAX_TOKENS", value)
    with pytest.raises(memo_generation.MemoGenerationError) as failure:
        memo_generation.generate_memo("system", "evidence")
    assert failure.value.code == "generation_configuration_invalid"
    assert sdk.clients == []


@pytest.mark.parametrize(
    "reason,code",
    [("max_tokens", "generation_truncated"), ("refusal", "generation_refused"), ("tool_use", "generation_incomplete")],
)
def test_incomplete_response_never_becomes_a_memo(sdk, reason, code):
    sdk.response.stop_reason = reason
    result = product.analyze({"question": "Test evidence gaps"})
    assert result["mode"] == "generation_failed"
    assert result["errors"] == [code]
    assert result["llm_invoked"] is True
    assert result["memo"] is None and result["memo_valid"] is False
    assert len(sdk.created) == 1


@pytest.mark.parametrize("stage,invoked", [("count", False), ("create", True)])
def test_provider_errors_are_redacted_and_not_retried(sdk, stage, invoked):
    setattr(sdk, stage + "_error", True)
    result = product.analyze({"question": "Test evidence gaps"})
    assert result["llm_invoked"] is invoked
    assert result["memo"] is None
    assert "private provider detail" not in json.dumps(result)
    assert len(sdk.created) == int(invoked)


@pytest.mark.parametrize(
    "text", ['{"a":1,"a":2}', '{"a":NaN}', '{"a":1e999}', "[{}]", "prefix {} suffix", "```json\n{}\n```"]
)
def test_ambiguous_or_wrapped_output_is_not_salvaged(text):
    assert product._extract_json_object(text) is None


def test_model_schema_success_still_requires_original_local_validation(sdk):
    result = product.analyze({"question": "Test evidence gaps"})
    assert result["llm_invoked"] is True
    assert result["memo_valid"] is False
    assert result["memo_quality_ok"] is False


def test_missing_key_preserves_host_completion(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    result = product.analyze({"question": "Test evidence gaps"})
    assert result["mode"] == "host_completion"
    assert result["llm_invoked"] is False


def test_installed_sdk_can_transform_generation_schema():
    anthropic = pytest.importorskip("anthropic")
    schema = anthropic.transform_schema(memo_generation.generation_schema())
    assert schema["type"] == "object"
    assert "minimum" not in schema["properties"]["audit"]["properties"]["validation_score"]

    # The provider allows at most 24 optional parameters per strict schema.
    def optional_count(node):
        if isinstance(node, list):
            return sum(optional_count(item) for item in node)
        if not isinstance(node, dict):
            return 0
        return len(set(node.get("properties", {})) - set(node.get("required", []))) + sum(
            optional_count(value) for value in node.values()
        )

    assert optional_count(schema) <= 24
