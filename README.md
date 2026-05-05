# Agenda Intelligence MD

[![PyPI version](https://img.shields.io/pypi/v/agenda-intelligence-md?style=flat-square)](https://pypi.org/project/agenda-intelligence-md/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![CI Status](https://github.com/vassiliylakhonin/agenda-intelligence-md/actions/workflows/ci.yml/badge.svg)](https://github.com/vassiliylakhonin/agenda-intelligence-md/actions)
[![GitHub stars](https://img.shields.io/github/stars/vassiliylakhonin/agenda-intelligence-md?style=flat-square)](https://github.com/vassiliylakhonin/agenda-intelligence-md/stargazers)

**A drop‑in cognition layer for AI agents that stops them from just summarizing news and starts producing decision‑ready analysis.**

> **Bottom line:** agents using this protocol move from *“monitor developments”* to *“watch these 3 indicators; if X happens, decision Y becomes urgent.”*

## 📊 Status

### ✅ Stable today
- **Markdown protocol** (`Agenda-Intelligence.md`) – core reasoning workflow.
- **JSON schemas** – validation for briefs, evidence packs, memory cards.
- **CLI validation** – `validate-brief`, `validate-evidence`, `validate-manifest`.
- **Source plans** – `source-plan`, `list-source-packs`, `source-types`.
- **Guided start** – `start` command prints trimmed plan + brief template.

### 🧪 Experimental / Planned
- **MCP integration** – `MCP.md` sketch, not yet functional.\n\n## MCP – Primary Adoption Channel (Sketch)
\nThe Multi‑Channel Protocol (MCP) is a **critical adoption path** that allows the Agenda‑Intelligence logic to be embedded directly into existing policy‑review workflows.  It is still in a **sketch stage**, but the skeleton is available in `docs/integrations/mcp.md`.  When complete, MCP will let users plug the protocol into a broader system with minimal friction, making it the most attractive route for enterprise adoption.
- **Fetch command** – stub in CLI, full evidence‑pack retrieval not implemented.
- **Scorer / eval** – `score` command relies on `eval_before_after.py` (only in editable installs).
- **Generate‑brief** – not yet exposed; use `start` + manual template fill.

> **Note:** The project is young. Stable parts are ready for production use; experimental bits are usable for testing but may change.

---

## 🚀 Quick start (OpenClaw)

1. **Install skill** (recommended):
   ```bash
   clawhub install agenda-intelligence
   ```
   Or copy `skills/agenda-intelligence/` into your workspace.

2. **Use in a prompt**:
   ```
   [skill:agenda-intelligence]
   Brief: "EU AI Act amendment adds new high‑risk categories."
   ```
   The agent will load the protocol, run the CLI, and return a compact brief.

3. **Or use the CLI directly** (after `pip install agenda-intelligence-md`):
   Use `agenda-intelligence start <category>` as the primary onboarding command. It prints a trimmed source plan, a brief template, and next commands.
   ```bash
   # Onboard with start command (recommended):
   agenda-intelligence start technology-ai
   # Output: trimmed source plan + brief template + next commands

   # Then continue with validation etc.:
   agenda-intelligence validate-brief examples/agenda-brief.json
   agenda-intelligence source-plan technology-ai
```

## Demo Output

When you run:

```bash
agenda-intelligence start technology-ai
```

You’ll see something like:

```text
=== Trimmed source plan ===
{
  "must_check": ["tech‑release", "policy‑update", "market‑data"]
}

=== Brief template (fill in) ===
{
  "bottom_line": "<summary>",
  "signal_classification": "<signal>",
  "what_changed": "<what changed>",
  "main_uncertainty": "<main uncertainty>",
  "watch_next": ["<indicator 1>", "<indicator 2>"]
}
```

Then after you fill the template, validate and score:

```bash
agenda-intelligence validate-brief brief.json
agenda-intelligence score brief.json
```

Output example (score):

```
Score: 78/100
- Relevance: 80
- Evidence Support: 75
- Completeness: 85
- Actionability: 70
- Clarity: 80
```

---

## 📐 Evaluation Assets

The project ships a **generic evaluation toolkit** to assess the *quality* of generated briefs:

- `evals/rubric.md` – Scoring rubric (relevance, evidence, completeness, actionability, clarity).
- `evals/llm_judge_prompt.txt` – Optional prompt for an LLM judge.
- `evals/human_checklist.md` - Structured checklist for manual review.
- `evals/cases/*.json` – Sample evaluation cases with expected scores.

These assets can be used for automated unit‑tests or for continuous‑integration quality gates.

---

## 🎯 What it does

| Without Agenda‑Intelligence.md | With Agenda‑Intelligence.md |
|--------------------------------|--------------------------------|
| “Companies should monitor developments.” | “Watch for regulator guidance, first enforcement action, compliance deadline, and product redesigns. Treat as signal until those indicators appear.” |

The protocol forces the agent to answer:
1. **Signal classification:** noise → weak signal → signal → structural shift → trigger event.
2. **What changed?** (fact)
3. **Why it matters?** (incentives, leverage)
4. **Who is affected?**
5. **Main uncertainty?**
6. **Scenarios & watch‑next indicators**

**Result:** shorter output, higher decision value. The protocol produces decision‑ready briefs in the format shown above.

---

## 🧠 Key features

- **Source Acquisition Layer** – tells the agent *which* source types to check before making claims (sanctions, regulation, elections, conflict, etc.).
- **AnalysisBank** – a memory layer that stores reusable reasoning patterns from good/bad outputs.
- **Regional lenses** – Central Asia & Caspian, Middle East, EU.
- **Sector lenses** – sanctions, export controls.
- **JSON schemas** – validate briefs, evidence packs, memory cards.
- **CLI & Python API** – `agenda-intelligence` command, `agent-manifest.json` for discovery.

---

## 📦 Installation

### From PyPI (when published)
```bash
pip install agenda-intelligence-md
```

### From GitHub Release
```bash
pip install https://github.com/vassiliylakhonin/agenda-intelligence-md/releases/download/v0.5.1/agenda_intelligence_md-0.5.1-py3-none-any.whl
```

### Editable install from source
```bash
git clone https://github.com/vassiliylakhonin/agenda-intelligence-md
cd agenda-intelligence-md
pip install -e .
```

---

## 🛠 CLI examples

```bash
agenda-intelligence --help
agenda-intelligence manifest
agenda-intelligence list-lenses
agenda-intelligence source-types
agenda-intelligence source-plan sanctions
agenda-intelligence validate-brief examples/agenda-brief.json
agenda-intelligence validate-evidence examples/source/evidence-pack.json
agenda-intelligence memory-search "sanctions routing"
```

---

## 📚 Documentation

- **Protocol:** [`Agenda-Intelligence.md`](Agenda-Intelligence.md) – the core reasoning workflow.
- **Quickstart:** [`docs/quickstart.md`](docs/quickstart.md)
- **Real‑world example:** 
  - [`examples/hormuz_strait_brief.md`](examples/hormuz_strait_brief.md) – Hormuz Strait shipping risk (2026).
- **Integrations:** [`docs/integrations/`](docs/integrations/) – Claude Code, OpenAI Codex, Cursor, MCP.
- **Evaluation:** [`docs/evaluation.md`](docs/evaluation.md) – how the scoring works.
- **Roadmap:** [`ROADMAP.md`](ROADMAP.md)

---

## 🏗 Repository structure

```
agenda-intelligence-md/
├─ src/agenda_intelligence/   # Python package
├─ schemas/                   # JSON schemas
├─ examples/                  # sample briefs, evidence packs
├─ analysis-bank/             # memory cards (failures & successes)
├─ skills/agenda-intelligence/ # OpenClaw skill wrapper
├─ docs/                      # guides & integration notes
└─ tests/                     # pytest suite
```

---

## 🤝 Contributing

Pull requests are welcome! Please:
1. Open an issue to discuss changes.
2. Create a feature branch (`feat/...`, `fix/...`).
3. Run `pytest` and ensure all tests pass.
4. Update docs if behavior changes.

See [`docs/quickstart.md`](docs/quickstart.md) for development setup.

---

## 📄 License

MIT – free for any use.

---

## 🔗 Related projects

- **[global-think-tank-analyst](https://github.com/vassiliylakhonin/global-think-tank-analyst)** – deeper policy‑risk memos for OpenClaw.

---

> **Why this exists:** Most agent‑written news analysis is a polished recap that doesn’t change any decision. This project gives agents a stricter workflow so their output actually helps someone decide, hedge, or act.
