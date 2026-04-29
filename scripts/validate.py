#!/usr/bin/env python3
from pathlib import Path

root = Path(__file__).resolve().parents[1]
required = [
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
]
missing = [p for p in required if not (root / p).exists()]
if missing:
    raise SystemExit(f"Missing required files: {missing}")

skill = (root / "skills/agenda-intelligence/SKILL.md").read_text()
for token in ["name: agenda-intelligence", "description:", "references/analysis-protocol.md"]:
    if token not in skill:
        raise SystemExit(f"SKILL.md missing token: {token}")

readme = (root / "README.md").read_text()
for token in ["Stop your AI agent from summarizing the news", "clawhub install agenda-intelligence", "Fact → Assessment"]:
    if token not in readme:
        raise SystemExit(f"README missing token: {token}")

print("OK: agenda-intelligence repo files validated")
