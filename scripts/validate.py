#!/usr/bin/env python3
from pathlib import Path

root = Path(__file__).resolve().parents[1]
required = [
    "examples/sector/sanctions-brief.md",
    "skills/agenda-intelligence/references/sector/sanctions.md",
    "ADOPTION.md",
    "Agenda-Intelligence.md",
    "README.md",
    "LICENSE",
    "llms.txt",
    "skills/agenda-intelligence/SKILL.md",
    "skills/agenda-intelligence/references/analysis-protocol.md",
    "skills/agenda-intelligence/references/agenda-triage.md",
    "skills/agenda-intelligence/references/evidence-discipline.md",
    "skills/agenda-intelligence/references/output-patterns.md",
    "skills/agenda-intelligence/references/regional/central-asia-caspian.md",
    "examples/central-asia-caspian-brief.md",
    "skills/agenda-intelligence/references/regional/middle-east.md",
    "examples/middle-east-brief.md",
    "skills/agenda-intelligence/references/regional/eu.md",
    "examples/eu-brief.md",
    "examples/before-after/README.md",
    "examples/before-after/eu-ai-act.md",
    "examples/before-after/red-sea-shipping.md",
    "examples/before-after/sanctions-routing.md",
    "examples/before-after/evaluation-rubric.md",
]
missing = [p for p in required if not (root / p).exists()]
if missing:
    raise SystemExit(f"Missing required files: {missing}")

skill = (root / "skills/agenda-intelligence/SKILL.md").read_text()
for token in ["name: agenda-intelligence", "description:", "references/analysis-protocol.md"]:
    if token not in skill:
        raise SystemExit(f"SKILL.md missing token: {token}")

readme = (root / "README.md").read_text()
for token in ["A markdown protocol for AI agents", "How to use it", "How it relates to AGENTS.md", "10-second demo", "Before / after examples", "Sector lens packs", "Fact → Assessment"]:
    if token not in readme:
        raise SystemExit(f"README missing token: {token}")

print("OK: agenda-intelligence repo files validated")
