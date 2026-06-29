"""Tests for the eval-layer commands added in the repositioning:
audit-claims, bench, verify-quotes, report. Plus the MCP audit_claims tool."""

from __future__ import annotations

import json
import os
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CLI = [sys.executable, "-m", "agenda_intelligence.cli"]
ENV = {**os.environ, "PYTHONPATH": str(ROOT / "src")}
FLAGSHIP_BRIEF = ROOT / "examples" / "source-backed" / "eu-ai-act.brief.json"
FLAGSHIP_AUDIT = ROOT / "examples" / "source-backed" / "eu-ai-act.audit.json"
SOURCE_BACKED_DIR = ROOT / "examples" / "source-backed"


def run(*args: str, expect_zero: bool = True) -> subprocess.CompletedProcess[str]:
    res = subprocess.run(CLI + list(args), capture_output=True, text=True, cwd=ROOT, env=ENV)
    if expect_zero:
        assert res.returncode == 0, f"cmd failed ({res.returncode}): {res.stderr}\n{res.stdout}"
    return res


# ---------- audit-claims ----------


def test_audit_claims_text(tmp_path: Path):
    res = run("audit-claims", str(FLAGSHIP_AUDIT))
    assert "OK: evidence audit validates" in res.stdout
    assert "support_level=direct" in res.stdout


def test_audit_claims_json(tmp_path: Path):
    res = run("audit-claims", str(FLAGSHIP_AUDIT), "--format", "json")
    payload = json.loads(res.stdout)
    assert payload["valid"] is True
    assert payload["claim_count"] == 3
    assert payload["support_levels"] == {"direct": 1, "partial": 1, "weak": 1}
    assert payload["orphan_evidence_refs"] == []


def test_audit_claims_strict_orphan(tmp_path: Path):
    bad = {
        "topic": "x",
        "claims": [
            {
                "claim_id": "c1",
                "claim": "test",
                "evidence_ids": ["missing"],
                "support_level": "direct",
            }
        ],
        "evidence": [],
    }
    p = tmp_path / "bad.json"
    p.write_text(json.dumps(bad))
    # Without --strict: orphan is a warning, exit 0
    run("audit-claims", str(p))
    # With --strict: exit 1
    res = run("audit-claims", str(p), "--strict", expect_zero=False)
    assert res.returncode == 1


# ---------- bench ----------


def test_bench_markdown_on_flagship():
    res = run("bench", str(SOURCE_BACKED_DIR))
    assert "# Bench report" in res.stdout
    assert "eu-ai-act" in res.stdout
    assert "with claim-level audit: 100.0%" in res.stdout
    assert "with source category: 100.0%" in res.stdout
    assert "source coverage gap cases:" in res.stdout
    assert "| case | schema | evidence | audit | source cat | source cov | gaps | orphans | score |" in res.stdout


def test_bench_json_on_flagship():
    res = run("bench", str(SOURCE_BACKED_DIR), "--format", "json")
    payload = json.loads(res.stdout)
    assert payload["summary"]["cases"] >= 1
    assert payload["summary"]["schema_valid_pct"] == 100.0
    assert payload["summary"]["audit_orphan_total"] == 0
    assert payload["summary"]["with_source_category_pct"] == 100.0
    assert payload["summary"]["source_coverage_missing_total"] >= 0
    case = next(item for item in payload["cases"] if item["case"] == "eu-ai-act")
    assert case["source_category"] == "technology-ai"
    assert case["source_coverage_pct"] is not None
    assert case["source_coverage_missing"] is not None


def test_bench_min_score_gate():
    res = run(
        "bench",
        str(SOURCE_BACKED_DIR),
        "--min-score",
        "9999",
        expect_zero=False,
    )
    assert res.returncode == 2


# ---------- source-coverage ----------


def test_source_categories_json_lists_known_categories():
    res = run("source-categories", "--format", "json")
    payload = json.loads(res.stdout)

    assert payload["implemented"] is True
    assert payload["error"] is None
    assert "sanctions" in payload["category_ids"]
    assert "technology-ai" in payload["category_ids"]
    sanctions = next(item for item in payload["categories"] if item["category"] == "sanctions")
    assert sanctions["must_check_count"] >= 1


def test_source_categories_text_lists_counts():
    res = run("source-categories")

    assert "sanctions: must_check=" in res.stdout
    assert "technology-ai: must_check=" in res.stdout


def test_source_coverage_reports_missing_required_sources(tmp_path: Path):
    pack = tmp_path / "pack.json"
    pack.write_text(
        json.dumps(
            {
                "topic": "sanctions claim",
                "evidence_mode": "user_provided",
                "claims": [
                    {
                        "claim": "Company X is sanctioned worldwide.",
                        "support_status": "partially_supported",
                        "sources": [
                            {
                                "name": "Media report about sanctions risk",
                                "source_type": "media",
                                "freshness": "current",
                                "supports": ["Mentions sanctions risk."],
                                "limits": ["Does not include official designation list or legal instrument."],
                            }
                        ],
                    }
                ],
                "unsupported_claims": ["Worldwide sanctions status is not backed by official lists."],
            }
        )
    )
    res = run("source-coverage", str(pack), "--category", "sanctions", "--format", "json")
    payload = json.loads(res.stdout)
    assert payload["category"] == "sanctions"
    assert "sanctions_list" in payload["missing_required_sources"]
    assert "legal_text" in payload["missing_required_sources"]
    assert payload["strict_gate_passed"] is False
    assert "Does not validate factual truth" in payload["note"]


def test_source_coverage_uses_evidence_source_category_when_category_omitted(tmp_path: Path):
    pack = tmp_path / "pack.json"
    pack.write_text(
        json.dumps(
            {
                "topic": "sanctions claim",
                "evidence_mode": "user_provided",
                "source_category": "sanctions",
                "claims": [
                    {
                        "claim": "Company X is sanctioned worldwide.",
                        "support_status": "partially_supported",
                        "sources": [],
                    }
                ],
                "unsupported_claims": ["Official source coverage is missing."],
            }
        )
    )
    res = run("source-coverage", str(pack), "--format", "json")
    payload = json.loads(res.stdout)
    assert payload["category"] == "sanctions"
    assert "sanctions_list" in payload["missing_required_sources"]


def test_source_coverage_errors_without_category_or_evidence_source_category(tmp_path: Path):
    pack = tmp_path / "pack.json"
    pack.write_text(
        json.dumps(
            {
                "topic": "uncategorized claim",
                "evidence_mode": "user_provided",
                "claims": [{"claim": "Test claim.", "support_status": "unsupported", "sources": []}],
                "unsupported_claims": ["No source category."],
            }
        )
    )
    res = run("source-coverage", str(pack), expect_zero=False)
    assert res.returncode == 1
    assert "Missing source category" in res.stderr


def test_source_coverage_strict_exits_nonzero_on_missing_sources(tmp_path: Path):
    pack = tmp_path / "pack.json"
    pack.write_text(
        json.dumps(
            {
                "topic": "sanctions claim",
                "evidence_mode": "user_provided",
                "claims": [],
                "unsupported_claims": ["No source coverage."],
            }
        )
    )
    res = run("source-coverage", str(pack), "--category", "sanctions", "--strict", expect_zero=False)
    assert res.returncode == 1
    assert "missing required sources" in res.stdout


def test_weekly_delta_command_markdown_on_synthetic_example():
    res = run(
        "weekly-delta",
        "examples/strategic-infrastructure-bankability/status.synthetic.md",
        "--project-alias",
        "ProjectCo",
        "--decision-moment",
        "committee review",
    )

    assert "# Weekly Status Decision-Readiness Delta" in res.stdout
    assert "Readiness delta: `unclear_due_to_missing_evidence`" in res.stdout
    assert "Next decision route: `escalate_before_committee`" in res.stdout
    assert "Demand is secured." in res.stdout


def test_weekly_delta_command_json_on_synthetic_example():
    res = run(
        "weekly-delta",
        "examples/strategic-infrastructure-bankability/status.synthetic.md",
        "--format",
        "json",
    )
    payload = json.loads(res.stdout)

    assert payload["valid"] is True
    assert payload["category"] == "ai-infrastructure-bankability"
    assert payload["next_decision_route"] == "escalate_before_committee"
    assert any(item["claim"] == "Procurement is ready for shortlist." for item in payload["unsafe_to_repeat_claims"])


def test_source_coverage_detects_sanctions_sources(tmp_path: Path):
    pack = tmp_path / "pack.json"
    pack.write_text(
        json.dumps(
            {
                "topic": "sanctions claim",
                "evidence_mode": "live_source_backed",
                "claims": [
                    {
                        "claim": "Company X is designated in one sanctions jurisdiction.",
                        "support_status": "supported",
                        "sources": [
                            {
                                "name": "OFAC SDN list entry",
                                "source_type": "official",
                                "freshness": "current",
                                "supports": ["Official sanctions list designation."],
                                "limits": ["US scope only."],
                            },
                            {
                                "name": "Sanctions legal text",
                                "source_type": "legal",
                                "freshness": "current",
                                "supports": ["Legal instrument for designation."],
                                "limits": [],
                            },
                            {
                                "name": "Regulator FAQ and license guidance",
                                "source_type": "official",
                                "freshness": "current",
                                "supports": ["Regulator guidance and general license details."],
                                "limits": [],
                            },
                        ],
                    }
                ],
                "unsupported_claims": [],
            }
        )
    )
    res = run("source-coverage", str(pack), "--category", "sanctions", "--format", "json")
    payload = json.loads(res.stdout)
    assert payload["missing_required_sources"] == []
    assert payload["strict_gate_passed"] is True
    sanctions_detail = next(
        item for item in payload["required_source_details"] if item["required_source"] == "sanctions_list"
    )
    assert sanctions_detail["status"] == "covered"
    assert sanctions_detail["matched_sources"][0]["name"] == "OFAC SDN list entry"
    assert "ofac" in sanctions_detail["matched_sources"][0]["matched_terms"]


def test_source_coverage_text_includes_matched_source_names(tmp_path: Path):
    pack = tmp_path / "pack.json"
    pack.write_text(
        json.dumps(
            {
                "topic": "sanctions claim",
                "evidence_mode": "live_source_backed",
                "claims": [
                    {
                        "claim": "Company X is designated in one sanctions jurisdiction.",
                        "support_status": "partially_supported",
                        "sources": [
                            {
                                "name": "OFAC SDN list entry",
                                "source_type": "official",
                                "freshness": "current",
                                "supports": ["Official sanctions list designation."],
                            }
                        ],
                    }
                ],
                "unsupported_claims": [],
            }
        )
    )
    res = run("source-coverage", str(pack), "--category", "sanctions")
    assert "matched by: OFAC SDN list entry" in res.stdout


# ---------- verify-quotes ----------


def test_verify_quotes_local_text(tmp_path: Path):
    texts = tmp_path / "evidence_text"
    texts.mkdir()
    (texts / "e1.txt").write_text("Article 19. High-risk AI systems shall undergo conformity assessment.")
    pack = tmp_path / "pack.json"
    pack.write_text(
        json.dumps(
            {
                "topic": "x",
                "evidence_mode": "user_provided",
                "sources": [
                    {
                        "evidence_id": "e1",
                        "name": "Doc",
                        "url": "https://example.com/x",
                        "source_type": "official_document",
                        "quote": "high-risk AI systems shall undergo conformity assessment",
                    },
                    {
                        "evidence_id": "e2",
                        "name": "Other",
                        "url": "https://example.com/y",
                        "source_type": "news",
                        "quote": "this fragment definitely does not appear",
                    },
                ],
            }
        )
    )
    res = run("verify-quotes", str(pack), "--texts-dir", str(texts), "--format", "json")
    payload = json.loads(res.stdout)
    assert payload["summary"]["present"] == 1
    assert payload["summary"]["missing_source_text"] == 1


def test_verify_quotes_strict(tmp_path: Path):
    texts = tmp_path / "evidence_text"
    texts.mkdir()
    pack = tmp_path / "pack.json"
    pack.write_text(
        json.dumps(
            {
                "topic": "x",
                "evidence_mode": "user_provided",
                "sources": [
                    {
                        "evidence_id": "e1",
                        "name": "Doc",
                        "url": "https://example.com/x",
                        "source_type": "official_document",
                        "quote": "anything",
                    }
                ],
            }
        )
    )
    res = run(
        "verify-quotes",
        str(pack),
        "--texts-dir",
        str(texts),
        "--strict",
        expect_zero=False,
    )
    assert res.returncode == 1
    assert "Does not discover sources" in res.stdout
    assert "verify factual truth" in res.stdout


# ---------- report ----------


def test_report_on_flagship():
    res = run("report", str(FLAGSHIP_BRIEF))
    assert "# Report:" in res.stdout
    assert "schema: PASS" in res.stdout
    assert "does not verify factual truth" in res.stdout


# ---------- MCP audit_claims tool ----------


def test_mcp_audit_claims_tool_valid():
    from agenda_intelligence.mcp_server import audit_claims

    audit = json.loads(FLAGSHIP_AUDIT.read_text())
    res = audit_claims(audit)
    assert res["implemented"] is True
    assert res["valid"] is True
    assert res["summary"]["claim_count"] == 3
    assert res["summary"]["support_levels"] == {"direct": 1, "partial": 1, "weak": 1}


def test_mcp_audit_claims_tool_invalid_schema():
    from agenda_intelligence.mcp_server import audit_claims

    res = audit_claims({"claims": [], "evidence": []})  # empty claims violates minItems
    assert res["valid"] is False
    assert res["errors"]


def test_mcp_audit_claims_tool_orphan_ref():
    from agenda_intelligence.mcp_server import audit_claims

    res = audit_claims(
        {
            "topic": "x",
            "claims": [
                {
                    "claim_id": "c1",
                    "claim": "test",
                    "evidence_ids": ["missing"],
                    "support_level": "direct",
                }
            ],
            "evidence": [],
        }
    )
    assert res["valid"] is True
    assert res["summary"]["orphan_evidence_refs"] == [{"claim_id": "c1", "missing_evidence_ids": ["missing"]}]


# ---------- MCP stdio: audit_claims registered ----------


def test_stdio_tools_list_includes_audit_claims():
    from agenda_intelligence.mcp_stdio import TOOLS

    assert "audit_claims" in TOOLS
    spec = TOOLS["audit_claims"]
    assert "audit_json" in spec["inputSchema"]["properties"]


# ---------- MCP verify_quotes tool ----------


def test_mcp_verify_quotes_present():
    from agenda_intelligence.mcp_server import verify_quotes

    pack = {
        "topic": "test",
        "evidence_mode": "user_provided",
        "sources": [
            {
                "evidence_id": "e1",
                "name": "Doc",
                "url": "https://example.com",
                "source_type": "official",
                "quote": "conformity assessment",
            }
        ],
    }
    res = verify_quotes(pack, texts={"e1": "Article 19. High-risk AI systems shall undergo conformity assessment."})
    assert res["implemented"] is True
    assert res["summary"]["present"] == 1
    assert res["summary"]["total_quotes"] == 1
    assert "score source reputation" in res["summary"]["note"]


def test_mcp_verify_quotes_absent():
    from agenda_intelligence.mcp_server import verify_quotes

    pack = {
        "topic": "test",
        "evidence_mode": "user_provided",
        "sources": [{"evidence_id": "e1", "name": "Doc", "source_type": "official", "quote": "not in text"}],
    }
    res = verify_quotes(pack, texts={"e1": "Something completely different."})
    assert res["summary"]["absent"] == 1
    assert res["summary"]["present"] == 0


def test_mcp_verify_quotes_missing_text():
    from agenda_intelligence.mcp_server import verify_quotes

    pack = {
        "topic": "test",
        "evidence_mode": "user_provided",
        "sources": [{"evidence_id": "e1", "name": "Doc", "source_type": "official", "quote": "anything"}],
    }
    res = verify_quotes(pack, texts={})
    assert res["summary"]["missing_source_text"] == 1


def test_mcp_verify_quotes_skips_sources_without_quote():
    from agenda_intelligence.mcp_server import verify_quotes

    pack = {
        "topic": "test",
        "evidence_mode": "user_provided",
        "sources": [{"evidence_id": "e1", "name": "Doc", "source_type": "official"}],
    }
    res = verify_quotes(pack, texts={"e1": "some text"})
    assert res["summary"]["total_quotes"] == 0


def test_mcp_verify_quotes_harvests_supporting_quotes():
    from agenda_intelligence.mcp_server import verify_quotes

    audit = {
        "topic": "test",
        "claims": [
            {
                "claim_id": "c1",
                "claim": "High-risk AI systems must undergo conformity assessment.",
                "evidence_ids": ["e1"],
                "support_level": "direct",
                "supporting_quotes": [
                    {"evidence_id": "e1", "quote": "high-risk AI systems shall undergo conformity assessment"},
                    {"evidence_id": "e1", "quote": "this fragment definitely does not appear"},
                ],
            }
        ],
        "evidence": [{"evidence_id": "e1", "source_type": "official_document"}],
    }
    res = verify_quotes(audit, texts={"e1": "Article 19. High-risk AI systems shall undergo conformity assessment."})
    assert res["summary"]["from_supporting_quotes"] == 2
    assert res["summary"]["present"] == 1
    assert res["summary"]["absent"] == 1
    # span results carry the originating claim_id
    assert all(r["claim_id"] == "c1" for r in res["results"])


def test_verify_quotes_supporting_quotes_local_text(tmp_path: Path):
    texts = tmp_path / "evidence_text"
    texts.mkdir()
    (texts / "e1.txt").write_text("Article 19. High-risk AI systems shall undergo conformity assessment.")
    pack = tmp_path / "audit.json"
    pack.write_text(
        json.dumps(
            {
                "topic": "x",
                "claims": [
                    {
                        "claim_id": "c1",
                        "claim": "conformity assessment is required",
                        "evidence_ids": ["e1"],
                        "support_level": "direct",
                        "supporting_quotes": [
                            {"evidence_id": "e1", "quote": "high-risk AI systems shall undergo conformity assessment"}
                        ],
                    }
                ],
                "evidence": [{"evidence_id": "e1", "name": "AI Act", "source_type": "official_document"}],
            }
        )
    )
    res = run("verify-quotes", str(pack), "--texts-dir", str(texts), "--format", "json")
    payload = json.loads(res.stdout)
    assert payload["summary"]["present"] == 1
    assert payload["summary"]["from_supporting_quotes"] == 1
    assert payload["results"][0]["claim_id"] == "c1"


def test_stdio_tools_list_includes_verify_quotes():
    from agenda_intelligence.mcp_stdio import TOOLS

    assert "verify_quotes" in TOOLS
    spec = TOOLS["verify_quotes"]
    assert "score source reputation" in spec["description"]
    assert "pack_json" in spec["inputSchema"]["properties"]
    assert "pack_json" in spec["inputSchema"]["required"]
