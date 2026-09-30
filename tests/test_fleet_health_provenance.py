"""Health proofs must reject scope promotion and removal of review boundaries."""

import base64
import copy
import importlib.util
import json
from pathlib import Path

import pytest


def load_proof(filename):
    path = Path(__file__).parents[1] / "scripts/fleet_health" / (filename + ".py")
    spec = importlib.util.spec_from_file_location(filename, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


TRUST = load_proof("proof_worker5_agentic_interaction_trust")
DUAL_USE = load_proof("proof_worker9_dual_use_technology_export")


@pytest.mark.parametrize(
    "module,key,receipt_key",
    [
        (TRUST, "trust_verification", "dlp_receipt"),
        (DUAL_USE, "dual_use_verification", "receipt"),
    ],
)
def test_health_proof_rejects_false_clearance(module, key, receipt_key):
    claims = {"scope": "dlp_scan_only", "engine": "vizier_dlp_firewall", "clean": True}
    encoded = base64.urlsafe_b64encode(json.dumps(claims).encode()).decode().rstrip("=")
    metadata = {
        key: {
            "ownership_status": "unverified",
            "signature_verified": False,
            "receipt_scope": "dlp_scan_only",
            "violation": False,
            "clean": None,
            "dlp_screening": {"clean": True},
            receipt_key: f"header.{encoded}.signature",
        },
        "vizier_clearance_receipt": None,
    }
    module.assert_scoped_provenance(metadata, False)
    for field, value in [
        ("clean", True),
        ("ownership_status", "verified"),
        ("signature_verified", True),
        ("receipt_scope", "full_clearance"),
    ]:
        altered = copy.deepcopy(metadata)
        altered[key][field] = value
        with pytest.raises(AssertionError):
            module.assert_scoped_provenance(altered, False)
    metadata["vizier_clearance_receipt"] = "promoted-dlp-token"
    with pytest.raises(AssertionError):
        module.assert_scoped_provenance(metadata, False)


def test_dual_use_proof_rejects_removed_review_or_full_readiness():
    triage = {
        "human_review_required": True,
        "factual_verification_performed": False,
        "score_scope": "declared_evidence_structure_only",
        "score": 69,
    }
    DUAL_USE.assert_review_boundary(triage)
    for key, value in [
        ("human_review_required", False),
        ("factual_verification_performed", True),
        ("score", 100),
        ("score_scope", "verified_clearance"),
    ]:
        with pytest.raises(AssertionError):
            DUAL_USE.assert_review_boundary({**triage, key: value})
