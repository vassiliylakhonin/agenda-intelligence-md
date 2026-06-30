#!/usr/bin/env python3
import importlib.util
import json
import subprocess
import sys
from pathlib import Path

for module in ["jsonschema", "referencing"]:
    if importlib.util.find_spec(module) is None:
        raise SystemExit(
            f"Missing required dependency: {module}. "
            f"Install project dependencies first (pip install -e .) "
            f"or run via the project venv: .venv/bin/python scripts/validate.py"
        )

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
    "source-requirements/middle-corridor-deal-risk.json",
    "examples/source/evidence-pack.json",
    "examples/source-backed/eu-ai-act.evidence.json",
    "examples/source-backed/red-sea-shipping.evidence.json",
    "examples/source-backed/sanctions-routing.evidence.json",
    "scripts/validate_public_examples.py",
    "schemas/v1/evidence-pack.schema.json",
    "schemas/v1/weekly-delta-fixture-manifest.schema.json",
    "source-taxonomy.json",
    "SOURCE_POLICY.md",
    "examples/agenda-brief.json",
    "scripts/agenda_intelligence.py",
    "schemas/v1/signal-classification.schema.json",
    "schemas/v1/lens-manifest.schema.json",
    "schemas/v1/memory-card.schema.json",
    "schemas/v1/agenda-brief.schema.json",
    "schemas/v1/middle-corridor-deal-risk-request.schema.json",
    "schemas/v1/middle-corridor-deal-risk-response.schema.json",
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
    "analysis-bank/memory_index.json",
    "docs/product/analysisbank-hardening-checkpoint.md",
    "docs/releases/RELEASE_NOTES_v1.1.0.md",
    "docs/releases/RELEASE_NOTES_v1.1.1.md",
    "tests/fixtures/analysis_bank_applicability/manifest.json",
    "tests/fixtures/analysis_bank_retrieval/manifest.json",
    "tests/fixtures/weekly_delta/manifest.json",
    "tests/fixtures/weekly_delta/golden/committee-escalation.md",
    "tests/fixtures/weekly_delta/failure/named-project-leak.md",
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
    "evidence-readiness and trust-routing runtime",
    "What this is",
    "What this is not",
    "First run",
    "source-backed/eu-ai-act.md",
    "Before / after",
    "AnalysisBank",
    "MCP",
    "Schemas",
    "Status",
    "Documentation",
    "Roadmap",
]:
    if token not in readme:
        raise SystemExit(f"README missing token: {token}")

for stale_token in [
    "Bundled-example baseline** (3 cases",
    "Heuristic benchmark baseline (3 bundled cases)",
    "mean 87.7/100",
]:
    if stale_token in readme:
        raise SystemExit(f"README contains stale benchmark claim: {stale_token}")

llms = (root / "llms.txt").read_text()
for token in [
    "Packaged CLI: agenda-intelligence",
    "MCP server: agenda-intelligence-mcp",
    "schemas/v1/evidence-audit.schema.json",
    "audit-claims",
    "mcp-config",
]:
    if token not in llms:
        raise SystemExit(f"llms.txt missing token: {token}")

for stale_token in [
    "MCP sketch",
    "CLI source commands: source-types",
]:
    if stale_token in llms:
        raise SystemExit(f"llms.txt contains stale token: {stale_token}")

for json_file in [
    "agent-manifest.json",
    "schemas/v1/agenda-brief.schema.json",
    "schemas/v1/memory-card.schema.json",
    "schemas/v1/lens-manifest.schema.json",
    "schemas/v1/signal-classification.schema.json",
    "examples/agenda-brief.json",
    "source-taxonomy.json",
    "schemas/v1/evidence-pack.schema.json",
    "schemas/v1/weekly-delta-fixture-manifest.schema.json",
    "examples/source/evidence-pack.json",
    "schemas/v1/middle-corridor-deal-risk-request.schema.json",
    "schemas/v1/middle-corridor-deal-risk-response.schema.json",
    "source-requirements/middle-corridor-deal-risk.json",
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
