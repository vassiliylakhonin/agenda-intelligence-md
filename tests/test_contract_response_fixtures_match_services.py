import json
from collections.abc import Callable
from pathlib import Path
from typing import Any

import pytest

from agenda_intelligence import services

ROOT = Path(__file__).resolve().parents[1]


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def cis_response(request: dict[str, Any]) -> dict[str, Any]:
    return services.cis_secondary_sanctions_exposure(request, allow_live_retrieval=False)


CONTRACTS: tuple[tuple[str, Callable[[dict[str, Any]], dict[str, Any]]], ...] = (
    ("examples/kazakhstan-middle-corridor/contract", services.middle_corridor_deal_risk),
    ("examples/agentic-interaction-trust/contract", services.agentic_interaction_trust),
    ("examples/cis-secondary-sanctions/contract", cis_response),
    ("examples/gulf-maritime-exposure/contract", services.gulf_maritime_exposure),
    ("examples/kazakhstan-market-entry-readiness/contract", services.kazakhstan_market_entry_readiness),
)


def contract_cases():
    for relative_dir, service_func in CONTRACTS:
        for request_path in sorted((ROOT / relative_dir).glob("*.request.json")):
            response_path = request_path.with_name(request_path.name.replace(".request.json", ".response.json"))
            yield pytest.param(
                request_path,
                response_path,
                service_func,
                id=str(request_path.relative_to(ROOT)),
            )


@pytest.mark.parametrize(("request_path", "response_path", "service_func"), list(contract_cases()))
def test_contract_response_fixture_matches_service_output(
    request_path: Path,
    response_path: Path,
    service_func: Callable[[dict[str, Any]], dict[str, Any]],
):
    result = service_func(load_json(request_path))

    assert result["valid"] is True, result.get("errors")
    assert result["response"] == load_json(response_path)
