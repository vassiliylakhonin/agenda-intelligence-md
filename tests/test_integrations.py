"""Tests for agenda_intelligence.integrations module."""

from __future__ import annotations

from agenda_intelligence.integrations import (
    EvidencePacketGuardrail,
    create_evidence_packet,
)


def test_create_evidence_packet_helper():
    packet = create_evidence_packet(
        claims=[{"claim_id": "c1", "text": "Claim text", "source_ids": ["s1"]}],
        sources=[{"source_id": "s1", "text": "Claim text in full."}],
    )
    assert "claims" in packet
    assert "sources" in packet
    assert packet["claims"][0]["claim_id"] == "c1"


def test_guardrail_check_and_is_complete():
    guardrail = EvidencePacketGuardrail(strict=True)

    good_packet = {
        "claims": [
            {
                "claim_id": "c1",
                "text": "The committee approved the capital budget.",
                "source_ids": ["s1"],
            }
        ],
        "sources": [
            {
                "source_id": "s1",
                "text": "The committee approved the capital budget on Tuesday.",
            }
        ],
    }
    res = guardrail.check(good_packet)
    assert guardrail.is_complete(res) is True

    bad_packet = {
        "claims": [
            {
                "claim_id": "c1",
                "text": "The committee approved the capital budget.",
                "source_ids": ["missing-s1"],
            }
        ],
        "sources": [],
    }
    bad_res = guardrail.check(bad_packet)
    assert guardrail.is_complete(bad_res) is False


def test_guardrail_validate_or_repair_loop():
    guardrail = EvidencePacketGuardrail(strict=True, max_repair_attempts=2)

    initial_bad_packet = {
        "claims": [
            {
                "claim_id": "c1",
                "text": "Company revenue grew by 50% in 2026.",
                "source_ids": ["missing-s1"],
            }
        ],
        "sources": [],
    }

    def fake_llm_repair(prompt: str) -> dict:
        assert "missing-s1" in prompt or "Evidence Packet Repair Instructions" in prompt
        # Return a repaired complete packet
        return {
            "claims": [
                {
                    "claim_id": "c1",
                    "text": "Company revenue grew by 50% in 2026.",
                    "source_ids": ["s1"],
                }
            ],
            "sources": [
                {
                    "source_id": "s1",
                    "text": "Company revenue grew by 50% in 2026 according to the audited annual report.",
                }
            ],
        }

    final_packet, success, history = guardrail.validate_or_repair(initial_bad_packet, fake_llm_repair)
    assert success is True
    assert len(history) == 1
    assert final_packet["sources"][0]["source_id"] == "s1"
