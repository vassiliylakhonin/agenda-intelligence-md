"""Tests for extended ingestion (CSV, TSV, HTML, empty PDF detection)."""

from __future__ import annotations

from pathlib import Path

import pytest

from agenda_intelligence.evidence_review import EvidenceReviewError, read_document_text


def test_read_csv_table(tmp_path: Path):
    csv_file = tmp_path / "financials.csv"
    csv_file.write_text("Year,Revenue,Growth\n2025,$100M,15%\n2026,$150M,50%\n", encoding="utf-8")
    text = read_document_text(csv_file)
    assert "Year | Revenue | Growth" in text
    assert "2026 | $150M | 50%" in text


def test_read_tsv_table(tmp_path: Path):
    tsv_file = tmp_path / "registry.tsv"
    tsv_file.write_text("ID\tEntity\tStatus\nE1\tCompany A\tActive\n", encoding="utf-8")
    text = read_document_text(tsv_file)
    assert "ID | Entity | Status" in text
    assert "E1 | Company A | Active" in text


def test_read_html_stripping(tmp_path: Path):
    html_file = tmp_path / "page.html"
    html_file.write_text(
        "<html><head><script>alert('malicious')</script><style>.body{color:red}</style></head>"
        "<body><h1>Press Release</h1><p>The company expanded into <b>Central Asia</b> in 2026.</p></body></html>",
        encoding="utf-8",
    )
    text = read_document_text(html_file)
    assert "alert" not in text
    assert ".body" not in text
    assert "Press Release" in text
    assert "The company expanded into Central Asia in 2026." in text


def test_read_empty_text_error(tmp_path: Path):
    empty_file = tmp_path / "empty.txt"
    empty_file.write_text("   \n\n  \t ", encoding="utf-8")
    with pytest.raises(EvidenceReviewError, match="No extractable text"):
        read_document_text(empty_file)
