"""Tests for agenda_intelligence.integrations module."""

from __future__ import annotations

import asyncio

from agenda_intelligence.integrations import (
    EvidenceClaim,
    EvidencePacket,
    EvidencePacketGuardrail,
    EvidenceQuote,
    EvidenceSource,
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


def test_typed_packet_serializes_to_and_checks_against_stable_contract():
    packet = EvidencePacket(
        packet_id="typed-1",
        topic="Typed SDK",
        claims=(
            EvidenceClaim(
                claim_id="c1",
                text="The committee approved the budget.",
                source_ids=("s1",),
                quotes=(EvidenceQuote("s1", "committee approved the budget"),),
            ),
        ),
        sources=(EvidenceSource("s1", "The committee approved the budget after review."),),
    )

    result = EvidencePacketGuardrail().check(packet)

    assert packet.to_dict()["packet_id"] == "typed-1"
    assert result["valid"] is True
    assert result["response"]["packet_status"] == "packet_complete"


def test_async_check_and_repair_do_not_require_asyncio_plugin():
    guardrail = EvidencePacketGuardrail(max_repair_attempts=1)
    initial = EvidencePacket(
        claims=(EvidenceClaim("c1", "The committee approved the budget.", ("missing",)),),
        sources=(),
    )

    async def repair(_: str) -> EvidencePacket:
        return EvidencePacket(
            claims=(EvidenceClaim("c1", "The committee approved the budget.", ("s1",)),),
            sources=(EvidenceSource("s1", "The committee approved the budget."),),
        )

    final_packet, success, history = asyncio.run(guardrail.validate_or_repair_async(initial, repair))

    assert success is True
    assert len(history) == 1
    assert final_packet["sources"][0]["source_id"] == "s1"


def test_langgraph_node_returns_a_state_delta_without_langgraph_dependency():
    guardrail = EvidencePacketGuardrail()
    node = guardrail.as_langgraph_node(packet_key="packet", result_key="check")
    packet = EvidencePacket(
        claims=(EvidenceClaim("c1", "The committee approved the budget.", ("s1",)),),
        sources=(EvidenceSource("s1", "The committee approved the budget."),),
    )

    delta = asyncio.run(node({"packet": packet, "untouched": True}))

    assert set(delta) == {"check"}
    assert delta["check"]["response"]["packet_status"] == "packet_complete"
