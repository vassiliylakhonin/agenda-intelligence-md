#!/usr/bin/env python3
import json
import subprocess
import sys
from pathlib import Path

root = Path(__file__).resolve().parents[1]
required = [
    "source-requirements/regional-risk.json",
    "source-requirements/technology-ai.json",
    "source-requirements/financial-market.json",
    "source-requirements/trade.json",
    "source-requirements/energy.json",
    "source-requirements/cyber-threats.json",
    "source-requirements/esg.json",
    "source-requirements/supply-chain-resilience.json",
    "source-requirements/conflict-security.json",
    "source-requirements/elections.json",
    "source-requirements/regulation.json",
    "source-requirements/sanctions.json",
    "examples/source/evidence-pack.json",
    "examples/source-backed/eu-ai-act.evidence.json",
    "examples/source-backed/red-sea-shipping.evidence.json",
    "examples/source-backed/sanctions-routing.evidence.json",
    "scripts/validate_public_examples.py",
    "schemas/evidence-pack.schema.json",
    "source-taxonomy.json",
    "SOURCE_POLICY.md",
    "examples/agenda-brief.json",
    "scripts/agenda_intelligence.py",
    "schemas/signal-classification.schema.json",
    "schemas/lens-manifest.schema.json",
    "schemas/memory-card.schema.json",
    "schemas/agenda-brief.schema.json",
    "MCP.md",
    "agent-manifest.json",
    "scripts/eval_before_after.py",
    "analysis-bank/prompts/induce-contrast-memory.md",
    "analysis-bank/prompts/induce-failure-memory.md",
    "analysis-bank/prompts/induce-success-memory.md",
    "analysis-bank/successes/sanctions-routing-signal-classification.md",
    "analysis-bank/failures/eu-rhetoric-treated-as-law.md",
    "analysis-bank/failures/overconfident-sanctions-upgrade.md",
    "analysis-bank/failures/vague-monitoring.md",
    "analysis-bank/MEMORY_FORMAT.md",
    "analysis-bank/README.md",
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
for token in [
    "machine-readable Markdown protocol",
    "Quickstart",
    "CLI happy path",
    "Source Acquisition Layer",
    "Examples",
    "source-backed/eu-ai-act.md",
    "Before/after",
    "AnalysisBank",
    "Documentation",
    "Roadmap",
]:
    if token not in readme:
        raise SystemExit(f"README missing token: {token}")

for json_file in [
    "agent-manifest.json",
    "schemas/agenda-brief.schema.json",
    "schemas/memory-card.schema.json",
    "schemas/lens-manifest.schema.json",
    "schemas/signal-classification.schema.json",
    "examples/agenda-brief.json",
    "source-taxonomy.json",
    "schemas/evidence-pack.schema.json",
    "examples/source/evidence-pack.json",
]:
    json.loads((root / json_file).read_text())

for json_file in sorted((root / "examples").glob("**/*.json")):
    json.loads(json_file.read_text())

subprocess.run([sys.executable, str(root / "scripts" / "eval_before_after.py")], check=True)
subprocess.run(
    [
        sys.executable,
        str(root / "scripts" / "agenda_intelligence.py"),
        "validate-brief",
        str(root / "examples" / "agenda-brief.json"),
    ],
    check=True,
)
subprocess.run(
    [
        sys.executable,
        str(root / "scripts" / "agenda_intelligence.py"),
        "validate-evidence",
        str(root / "examples" / "source" / "evidence-pack.json"),
    ],
    check=True,
)
subprocess.run([sys.executable, str(root / "scripts" / "validate_public_examples.py")], check=True)
subprocess.run(
    [sys.executable, str(root / "scripts" / "agenda_intelligence.py"), "source-plan", "technology-ai"],
    check=True,
    stdout=subprocess.DEVNULL,
)

print("OK: agenda-intelligence repo files validated")
