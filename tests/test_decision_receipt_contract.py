"""Contract tests for the hosted signed readiness-receipt Gate."""

import json
from pathlib import Path

import pytest
from jsonschema import Draft202012Validator, ValidationError

ROOT = Path(__file__).resolve().parents[1]
SCHEMA_DIR = ROOT / "schemas" / "v1"


def load_schema(name: str) -> dict:
    return json.loads((SCHEMA_DIR / name).read_text(encoding="utf-8"))


def signed_receipt() -> dict:
    return {
        "format": "agenda-readiness-receipt+jws",
        "token": "header.payload.signature",
        "receipt_id": "receipt-1",
        "issued_at": "2026-08-24T12:00:00.000Z",
        "expires_at": "2026-08-24T12:05:00.000Z",
        "request_hash": "sha256:" + "a" * 64,
        "action_hash": "sha256:" + "b" * 64,
        "verification_tool": "decision_verify",
    }


def test_policy_catalog_contract_accepts_the_single_bounded_policy() -> None:
    request_schema = load_schema("decision-policies-list-request.schema.json")
    response_schema = load_schema("decision-policies-list-response.schema.json")
    Draft202012Validator(request_schema).validate({})
    with pytest.raises(ValidationError):
        Draft202012Validator(request_schema).validate({"policy": "invented"})

    Draft202012Validator(response_schema).validate(
        {
            "policies": [
                {
                    "policy_id": "pre-action-check.v1",
                    "policy_version": "pre-action-check.v1",
                    "decision_tool": "decision_check",
                    "verify_tool": "decision_verify",
                    "input_schema": (
                        "https://github.com/vassiliylakhonin/agenda-intelligence-md/"
                        "blob/main/schemas/v1/pre-action-check-request.schema.json"
                    ),
                    "decisions": ["continue", "request_evidence", "require_approval", "stop"],
                    "positive_decision": "continue",
                    "receipt_ttl_seconds": 300,
                }
            ],
            "receipt_format": "agenda-readiness-receipt+jws",
            "binding": {
                "request_hash": {
                    "algorithm": "SHA-256",
                    "canonicalization": "RFC8785-JCS",
                    "input": "complete_request",
                },
                "action_hash": {
                    "algorithm": "SHA-256",
                    "canonicalization": "RFC8785-JCS",
                    "fields": ["actor", "requested_action", "target", "risk_tier"],
                },
            },
            "not_authorization_notice": "This readiness receipt is not authorization.",
        }
    )


def test_pre_action_response_contract_accepts_an_additive_signed_receipt() -> None:
    response_schema = load_schema("pre-action-check-response.schema.json")
    response = {
        "decision_id": "decision-1",
        "run_id": "run-1",
        "policy_version": "pre-action-check.v1",
        "decision": "continue",
        "reason_code": "evidence_ready",
        "blocking_gaps": [],
        "evidence_requests": [],
        "approval_required": False,
        "human_review_required": False,
        "verification": {"verdict": "allow_relay", "evidence_gaps": [], "owner_actions": []},
        "policy_checks": [],
        "receipt_status": "signed",
        "receipt": signed_receipt(),
        "not_authorization_notice": "Readiness only; not authorization.",
        "limitations": [],
    }
    Draft202012Validator(response_schema).validate(response)


def test_receipt_verify_contract_has_a_golden_result_and_rejects_bad_hashes() -> None:
    request_schema = load_schema("decision-receipt-verify-request.schema.json")
    response_schema = load_schema("decision-receipt-verify-response.schema.json")
    request = {
        "receipt": signed_receipt()["token"],
        "expected_request_hash": signed_receipt()["request_hash"],
        "expected_action_hash": signed_receipt()["action_hash"],
    }
    Draft202012Validator(request_schema).validate(request)
    with pytest.raises(ValidationError):
        Draft202012Validator(request_schema).validate({**request, "expected_action_hash": "not-a-hash"})

    Draft202012Validator(response_schema).validate(
        {
            "signature_valid": True,
            "binding_matches": True,
            "expired": False,
            "gate_passed": True,
            "reason_code": "valid_continue_receipt",
            "receipt": {
                "receipt_id": "receipt-1",
                "decision_id": "decision-1",
                "run_id": "run-1",
                "policy_version": "pre-action-check.v1",
                "decision": "continue",
                "reason_code": "evidence_ready",
                "request_hash": signed_receipt()["request_hash"],
                "action_hash": signed_receipt()["action_hash"],
                "issued_at": signed_receipt()["issued_at"],
                "expires_at": signed_receipt()["expires_at"],
                "issuer": "https://agent-output-verification-a2a.example.workers.dev",
                "not_authorization": True,
            },
            "not_authorization_notice": "A valid receipt is not authorization.",
        }
    )
