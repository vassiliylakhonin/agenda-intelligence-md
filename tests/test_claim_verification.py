import copy
import json
from pathlib import Path

from agenda_intelligence import mcp_server
from agenda_intelligence.mcp_stdio import TOOLS
from agenda_intelligence.services import verify_claims

ROOT = Path(__file__).resolve().parents[1]
REQUEST = json.loads((ROOT / "examples/claim-verification/request.json").read_text())
LIVE_RELEASE_REQUEST = json.loads((ROOT / "examples/claim-verification/live-release-1.2.0.request.json").read_text())


def test_verified_with_fresh_independent_authoritative_sources():
    result = verify_claims(REQUEST)
    assert result["valid"] is True
    assert result["response"]["results"][0]["verdict"] == "verified"


def test_conflicting_authoritative_sources_are_unresolved():
    request = copy.deepcopy(REQUEST)
    request["evidence"][1]["stance"] = "contradicts"
    result = verify_claims(request)
    assert result["response"]["results"][0]["verdict"] == "unresolved"


def test_stale_sources_do_not_verify_claim():
    request = copy.deepcopy(REQUEST)
    request["evidence"][0]["retrieved_at"] = "2025-01-01"
    request["evidence"][1]["retrieved_at"] = "2025-01-01"
    result = verify_claims(request)
    item = result["response"]["results"][0]
    assert item["verdict"] == "unresolved"
    assert item["stale_evidence_ids"] == ["registry", "filing"]


def test_subject_mismatch_is_excluded():
    request = copy.deepcopy(REQUEST)
    request["evidence"][0]["subject_identifiers"] = ["BIN:other"]
    result = verify_claims(request)
    item = result["response"]["results"][0]
    assert item["verdict"] == "partially_supported"
    assert item["excluded_evidence"][0]["reason"] == "subject_identity_mismatch"


def test_prediction_is_not_verifiable():
    request = copy.deepcopy(REQUEST)
    request["claims"][0]["claim_kind"] = "prediction"
    result = verify_claims(request)
    assert result["response"]["results"][0]["verdict"] == "not_verifiable"


def test_invalid_request_fails_schema_validation():
    result = verify_claims({"as_of": "2026-07-11", "claims": [], "evidence": []})
    assert result["valid"] is False
    assert result["response"] is None


def test_invalid_calendar_date_returns_validation_error():
    request = copy.deepcopy(REQUEST)
    request["as_of"] = "2026-99-99"
    result = verify_claims(request)
    assert result["valid"] is False
    assert "invalid ISO date" in result["errors"][0]


def test_mcp_surface_delegates_to_service():
    assert "verify_claims" in TOOLS
    assert mcp_server.verify_claims(REQUEST) == verify_claims(REQUEST)


def test_live_release_example_has_verified_pypi_and_github_claims():
    result = verify_claims(LIVE_RELEASE_REQUEST)

    assert result["valid"] is True
    assert [item["verdict"] for item in result["response"]["results"]] == ["verified", "verified"]
