"""Tests for build_repair_prompt service function and CLI command."""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

from agenda_intelligence.services import build_repair_prompt

ROOT = Path(__file__).resolve().parents[1]
CLI = [sys.executable, "-m", "agenda_intelligence.cli"]
ENV = {**os.environ, "PYTHONPATH": str(ROOT / "src")}


def test_repair_prompt_for_complete_packet():
    packet = {
        "claims": [
            {
                "claim_id": "c1",
                "text": "The committee approved the budget on July 1.",
                "source_ids": ["s1"],
                "quotes": [],
            }
        ],
        "sources": [
            {
                "source_id": "s1",
                "text": "The committee approved the budget on July 1.",
            }
        ],
    }
    prompt = build_repair_prompt(packet)
    assert "Complete" in prompt or "No repair needed" in prompt


def test_repair_prompt_for_missing_source_and_unmatched_numbers():
    packet = {
        "claims": [
            {
                "claim_id": "c1",
                "text": "Revenue increased by 42% in 2026.",
                "source_ids": ["s1", "missing-s2"],
                "quotes": [
                    {
                        "source_id": "s1",
                        "text": "Completely absent quote text not in source",
                    }
                ],
            }
        ],
        "sources": [
            {
                "source_id": "s1",
                "text": "The company reported general growth across several departments.",
            }
        ],
    }
    prompt = build_repair_prompt(packet)
    assert "Evidence Packet Repair Instructions" in prompt
    assert "Claim `c1`" in prompt
    assert "missing-s2" in prompt
    assert "Misquoted / Absent Quote" in prompt
    assert "42%" in prompt


def test_repair_prompt_for_polarity_mismatch():
    packet = {
        "claims": [
            {
                "claim_id": "c1",
                "text": "The regulator did not approve the merger application.",
                "source_ids": ["s1"],
                "quotes": [],
            }
        ],
        "sources": [
            {
                "source_id": "s1",
                "text": "The regulator approved the merger application after reviewing the commitments.",
            }
        ],
    }
    prompt = build_repair_prompt(packet)
    assert "Negation / Polarity Conflict" in prompt


def test_repair_prompt_cli_subcommand(tmp_path: Path):
    packet = {
        "claims": [
            {
                "claim_id": "c1",
                "text": "Claim with missing source reference.",
                "source_ids": ["missing-s1"],
            }
        ],
        "sources": [],
    }
    req_file = tmp_path / "req.json"
    req_file.write_text(json.dumps(packet))
    out_file = tmp_path / "repair.md"

    res = subprocess.run(
        CLI + ["repair-prompt", str(req_file), "--out", str(out_file)],
        capture_output=True,
        text=True,
        cwd=ROOT,
        env=ENV,
    )
    assert res.returncode == 0
    assert out_file.is_file()
    content = out_file.read_text()
    assert "Evidence Packet Repair Instructions" in content
    assert "missing-s1" in content
