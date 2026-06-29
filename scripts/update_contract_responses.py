"""Regenerate public contract response fixtures from the service layer."""

from __future__ import annotations

import json
import sys
from collections.abc import Callable
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from agenda_intelligence import services  # noqa: E402


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, payload: dict[str, Any]) -> None:
    path.write_text(json.dumps(payload, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


def cis_response(request: dict[str, Any]) -> dict[str, Any]:
    return services.cis_secondary_sanctions_exposure(request, allow_live_retrieval=False)


CONTRACTS: tuple[tuple[str, Callable[[dict[str, Any]], dict[str, Any]]], ...] = (
    ("examples/kazakhstan-middle-corridor/contract", services.middle_corridor_deal_risk),
    ("examples/agentic-interaction-trust/contract", services.agentic_interaction_trust),
    ("examples/cis-secondary-sanctions/contract", cis_response),
    ("examples/gulf-maritime-exposure/contract", services.gulf_maritime_exposure),
    ("examples/kazakhstan-market-entry-readiness/contract", services.kazakhstan_market_entry_readiness),
)


def main() -> int:
    updated: list[Path] = []
    for relative_dir, service_func in CONTRACTS:
        contract_dir = ROOT / relative_dir
        for request_path in sorted(contract_dir.glob("*.request.json")):
            result = service_func(load_json(request_path))
            if not result.get("valid"):
                raise SystemExit(f"{request_path}: service returned invalid response: {result.get('errors')}")
            response = result.get("response")
            if not isinstance(response, dict):
                raise SystemExit(f"{request_path}: service did not return a response object")

            response_path = request_path.with_name(request_path.name.replace(".request.json", ".response.json"))
            write_json(response_path, response)
            updated.append(response_path.relative_to(ROOT))

    print(f"Updated {len(updated)} contract response fixtures:")
    for path in updated:
        print(f"- {path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
