from __future__ import annotations

import json
import os
import subprocess
import sys
import zipfile
from pathlib import Path

import pytest

from agenda_intelligence.services import check_evidence_packet

ROOT = Path(__file__).resolve().parents[1]
EXAMPLE = ROOT / "examples" / "evidence-review" / "manifest.json"
CLI = [sys.executable, "-m", "agenda_intelligence.cli"]
ENV = {**os.environ, "PYTHONPATH": str(ROOT / "src")}


def _packet(claim: str, source: str) -> dict:
    return {
        "claims": [{"claim_id": "c1", "text": claim, "source_ids": ["s1"]}],
        "sources": [{"source_id": "s1", "text": source}],
    }


def test_identical_cyrillic_claim_is_supported():
    response = check_evidence_packet(_packet("Совет директоров одобрил проект.", "Совет директоров одобрил проект."))[
        "response"
    ]

    assert response["packet_status"] == "packet_complete"
    assert response["claims"][0]["lexical_support"] == {
        "status": "supported",
        "coverage": 1.0,
        "best_source_id": "s1",
        "unmatched_numbers": [],
    }


def test_cyrillic_negation_mismatch_requires_review():
    response = check_evidence_packet(
        _packet("Совет директоров одобрил проект.", "Совет директоров не одобрил проект.")
    )["response"]

    assert response["packet_status"] == "source_review_required"
    assert "lexical_support_polarity_mismatch" in response["claims"][0]["issues"]


def test_identical_arabic_claim_is_supported():
    response = check_evidence_packet(_packet("وافق المجلس على المشروع.", "وافق المجلس على المشروع."))["response"]

    assert response["packet_status"] == "packet_complete"
    assert response["claims"][0]["lexical_support"]["coverage"] == 1.0


def test_unicode_tokenizer_keeps_percentage_as_a_numeric_value():
    response = check_evidence_packet(_packet("Рост составил 62%.", "Рост составил 62 единицы."))["response"]

    assert response["packet_status"] == "source_review_required"
    assert response["claims"][0]["lexical_support"]["unmatched_numbers"] == ["62%"]


def test_file_manifest_loads_relative_utf8_sources():
    from agenda_intelligence.evidence_review import load_review_manifest

    packet = load_review_manifest(EXAMPLE)

    assert packet["sources"][0]["text"] == "# Решение\n\nСовет директоров одобрил проект."
    assert packet["sources"][1]["text"] == "Бюджет проекта составляет 20 миллионов евро."
    assert all("path" not in source for source in packet["sources"])


def test_file_manifest_extracts_docx_without_external_dependency(tmp_path: Path):
    from agenda_intelligence.evidence_review import read_document_text

    document = tmp_path / "source.docx"
    xml = """<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
      <w:body><w:p><w:r><w:t>Совет директоров</w:t></w:r><w:r><w:t> одобрил проект.</w:t></w:r></w:p></w:body>
    </w:document>"""
    with zipfile.ZipFile(document, "w") as archive:
        archive.writestr("word/document.xml", xml)

    assert read_document_text(document) == "Совет директоров одобрил проект."


def test_file_manifest_rejects_path_outside_manifest_directory(tmp_path: Path):
    from agenda_intelligence.evidence_review import (
        EvidenceReviewError,
        load_review_manifest,
    )

    outside = tmp_path.parent / "outside-source.txt"
    outside.write_text("outside", encoding="utf-8")
    manifest = tmp_path / "manifest.json"
    manifest.write_text(
        json.dumps(
            {
                "claims": [{"claim_id": "c1", "text": "claim", "source_ids": ["s1"]}],
                "sources": [{"source_id": "s1", "path": "../outside-source.txt"}],
            }
        ),
        encoding="utf-8",
    )

    with pytest.raises(EvidenceReviewError, match="outside the manifest directory"):
        load_review_manifest(manifest)


def test_document_reader_rejects_oversized_input_before_extraction(tmp_path: Path, monkeypatch):
    from agenda_intelligence import evidence_review

    source = tmp_path / "source.txt"
    source.write_text("1234", encoding="utf-8")
    monkeypatch.setattr(evidence_review, "MAX_SOURCE_BYTES", 3)

    with pytest.raises(evidence_review.EvidenceReviewError, match="exceeds 3 bytes"):
        evidence_review.read_document_text(source)


def test_markdown_report_keeps_human_review_and_limitations_visible():
    from agenda_intelligence.evidence_review import render_review_markdown

    packet = _packet("Совет директоров одобрил проект.", "Совет директоров одобрил проект.")
    response = check_evidence_packet(packet)["response"]
    report = render_review_markdown(packet, response)

    assert "# Evidence review" in report
    assert "Совет директоров одобрил проект." in report
    assert "Human review required: yes" in report
    assert "Factuality: not assessed" in report
    assert "## Limitations" in report


def test_markdown_report_treats_claim_and_source_metadata_as_data():
    from agenda_intelligence.evidence_review import render_review_markdown

    packet = {
        "claims": [
            {
                "claim_id": "c`1",
                "text": "<script>alert(1)</script> | approved",
                "source_ids": ["s`1"],
            }
        ],
        "sources": [{"source_id": "s`1", "title": "<b>source</b>", "text": "approved"}],
    }
    response = check_evidence_packet(packet)["response"]
    report = render_review_markdown(packet, response)

    assert "<script>" not in report
    assert "<b>" not in report
    assert "&#96;" in report
    assert "\\| approved" in report


def test_cli_review_writes_markdown(tmp_path: Path):
    output = tmp_path / "review.md"
    result = subprocess.run(
        CLI + ["review", str(EXAMPLE), "--out", str(output), "--strict"],
        cwd=ROOT,
        env=ENV,
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode == 0, result.stderr
    assert result.stdout == f"Wrote {output}\n"
    report = output.read_text(encoding="utf-8")
    assert "packet_complete" in report
    assert "Совет директоров одобрил проект." in report


def test_cli_review_json_does_not_echo_source_text():
    result = subprocess.run(
        CLI + ["review", str(EXAMPLE), "--format", "json"],
        cwd=ROOT,
        env=ENV,
        capture_output=True,
        text=True,
        check=False,
    )

    assert result.returncode == 0, result.stderr
    payload = json.loads(result.stdout)
    assert payload["packet_status"] == "packet_complete"
    assert "Бюджет проекта составляет" not in result.stdout
