"""Tests for standalone HTML review reports."""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

from agenda_intelligence.evidence_review import render_review_html

ROOT = Path(__file__).resolve().parents[1]
CLI = [sys.executable, "-m", "agenda_intelligence.cli"]
ENV = {**os.environ, "PYTHONPATH": str(ROOT / "src")}


def test_render_review_html_basic_structure():
    packet = {
        "packet_id": "test-pack-01",
        "topic": "Middle Corridor Transit Expansion",
        "claims": [
            {
                "claim_id": "c1",
                "text": "Transit volumes increased 62% in 2024.",
                "source_ids": ["s1"],
            }
        ],
        "sources": [
            {
                "source_id": "s1",
                "title": "Middle Corridor Association 2024 Annual Note",
                "url": "https://example.com/report.pdf",
                "text": "Transit volumes increased 62% in 2024 across all routes.",
            }
        ],
    }

    response = {
        "packet_status": "packet_complete",
        "factuality_status": "supported",
        "human_review_required": False,
        "counts": {"packet_complete": 1, "source_review_required": 0, "packet_incomplete": 0},
        "claims": [
            {
                "claim_id": "c1",
                "referenced_source_ids": ["s1"],
                "packet_status": "packet_complete",
                "lexical_support": {"status": "grounded", "coverage": 1.0},
                "issues": [],
            }
        ],
        "owner_actions": [],
        "limitations": ["Lexical coverage is deterministic only."],
    }

    rendered = render_review_html(packet, response)
    assert "<!DOCTYPE html>" in rendered
    assert "Middle Corridor Transit Expansion" in rendered
    assert "packet_complete" in rendered
    assert "Transit volumes increased 62% in 2024." in rendered
    assert "s1" in rendered
    assert "https://example.com/report.pdf" in rendered
    assert "document.querySelectorAll" in rendered


def test_cli_review_html_output(tmp_path: Path):
    doc_file = tmp_path / "source.txt"
    doc_file.write_text("The board approved capital budget of $10M for 2026.")
    manifest_data = {
        "topic": "Budget Review",
        "claims": [
            {
                "claim_id": "c1",
                "text": "The board approved capital budget of $10M for 2026.",
                "source_ids": ["src1"],
            }
        ],
        "sources": [
            {
                "source_id": "src1",
                "path": "source.txt",
            }
        ],
    }
    manifest_path = tmp_path / "manifest.json"
    manifest_path.write_text(json.dumps(manifest_data))
    out_html = tmp_path / "report.html"

    res = subprocess.run(
        CLI + ["review", str(manifest_path), "--format", "html", "--out", str(out_html)],
        capture_output=True,
        text=True,
        cwd=ROOT,
        env=ENV,
    )
    assert res.returncode == 0
    assert out_html.is_file()
    content = out_html.read_text()
    assert "<!DOCTYPE html>" in content
    assert "Budget Review" in content
    assert "packet_complete" in content
