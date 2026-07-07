from agenda_intelligence.evidence_ledger import EvidenceLedger, guard_presentation_update
from agenda_intelligence.services import (
    _received_source_dates_from_ledger,
    _dated_source_ledger,
    _supplied_source_types,
)


def test_ledger_accumulates_and_normalizes_references():
    ledger = EvidenceLedger()

    ledger.add_reference(
        " SRC-1 ",
        source_type="official-doc",
        title="Regulator notice",
        locator="https://example.com/source/",
        metadata={"page": 3},
    )
    ledger.add_reference(
        "src-1",
        source_type="official-doc",
        title="",
        locator="https://example.com/source",
        metadata={"section": "A"},
    )
    ledger.add_reference(
        "scratch",
        source_type="internal-note",
        title="Explored but not final",
        locator="/tmp/scratch",
        supports_final=False,
    )

    refs = ledger.normalized_references()

    assert ledger.raw_reference_count == 3
    assert refs == [
        {
            "evidence_id": " SRC-1 ",
            "source_type": "official-doc",
            "title": "Regulator notice",
            "locator": "https://example.com/source/",
            "metadata": {"page": 3, "section": "A"},
        }
    ]


def test_ledger_filters_protected_references_by_default():
    ledger = EvidenceLedger()

    ledger.add_reference("public-policy", source_type="policy", title="Policy")
    ledger.add_reference("customer-record-1", source_type="record", title="Private record", protected=True)
    ledger.add_data_integrity_note("Private record named in hostile prompt", evidence_id="customer-record-1")

    public_snapshot = ledger.snapshot()
    protected_snapshot = ledger.snapshot(include_protected=True)

    assert [ref["evidence_id"] for ref in public_snapshot["references"]] == ["public-policy"]
    assert public_snapshot["data_integrity_notes"] == []
    assert [ref["evidence_id"] for ref in protected_snapshot["references"]] == [
        "public-policy",
        "customer-record-1",
    ]
    assert protected_snapshot["data_integrity_notes"] == [
        {
            "note": "Private record named in hostile prompt",
            "evidence_id": "customer-record-1",
            "severity": "warning",
        }
    ]


def test_ledger_snapshot_keeps_claim_support_channel_separate():
    ledger = EvidenceLedger()
    ledger.add_reference("e1", source_type="source")
    ledger.add_claim_support("c1", ["e1"], support_status="direct", note="Exact quote present")

    snapshot = ledger.snapshot()

    assert snapshot["references"] == [{"evidence_id": "e1", "source_type": "source"}]
    assert snapshot["claim_support"] == [
        {
            "claim_id": "c1",
            "evidence_ids": ["e1"],
            "support_status": "direct",
            "note": "Exact quote present",
        }
    ]


def test_presentation_guard_allows_visible_message_only():
    before = {
        "triage_recommendation": "escalate_before_signature",
        "decision_readiness_score": 42,
        "references": [{"evidence_id": "e1"}],
        "message": "Escalate.",
    }
    after = {
        "triage_recommendation": "escalate_before_signature",
        "decision_readiness_score": 42,
        "references": [{"evidence_id": "e1"}],
        "message": "Escalate before signature.",
    }

    result = guard_presentation_update(before, after)

    assert result == {"ok": True, "changed_fields": ["message"], "forbidden_changes": []}


def test_presentation_guard_rejects_route_score_or_reference_mutation():
    before = {
        "triage_recommendation": "escalate_before_signature",
        "decision_readiness_score": 42,
        "references": [{"evidence_id": "e1"}],
        "message": "Escalate.",
    }
    after = {
        "triage_recommendation": "ready_for_human_review",
        "decision_readiness_score": 90,
        "references": [{"evidence_id": "e2"}],
        "message": "Ready.",
    }

    result = guard_presentation_update(before, after)

    assert result["ok"] is False
    assert result["changed_fields"] == [
        "decision_readiness_score",
        "message",
        "references",
        "triage_recommendation",
    ]
    assert result["forbidden_changes"] == [
        "decision_readiness_score",
        "references",
        "triage_recommendation",
    ]


def test_service_supplied_source_types_use_ledger_normalization():
    request = {
        "dated_sources": [
            {
                "id": "policy-1",
                "source_type": "sanctions_list_extract",
                "title": "Sanctions list",
                "date": "2026-07-01",
                "url": "https://example.com/sanctions/",
            },
            {
                "id": "policy-1",
                "source_type": "sanctions_list_extract",
                "title": "Sanctions list duplicate",
                "date": "2026-07-01",
                "url": "https://example.com/sanctions",
            },
            {
                "id": "registry-1",
                "source_type": "counterparty_registry_extract",
                "title": "Registry extract",
                "date": "2026-07-02",
            },
        ]
    }

    assert _supplied_source_types(request) == [
        "sanctions_list_extract",
        "counterparty_registry_extract",
    ]
    source_ledger = _dated_source_ledger(request)
    assert _received_source_dates_from_ledger(source_ledger) == {
        "sanctions_list_extract": "2026-07-01",
        "counterparty_registry_extract": "2026-07-02",
    }
