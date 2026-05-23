# Quick‑start Tutorial

The goal of this guide is to walk you through an entire *end‑to‑end* workflow that demonstrates the Agenda Intelligence protocol in just 5‑10 minutes. By the end you will have produced a **decision‑ready brief** from scratch, validated it, and run a quick heuristic protocol score.

## Prerequisites

* A working **Python 3.9+** environment (virtualenv, conda, etc.)
* **Git** installed to clone the repo or **pip** for a binary install
* Internet access for downloading data files

## 1. Install the package

```bash
# Either install from PyPI for quick use
pip install agenda-intelligence-md

# Or, if you want the latest bleeding‑edge, clone and install editable
git clone https://github.com/vassiliylakhonin/agenda-intelligence-md
cd agenda-intelligence-md
pip install -e .
```

Running the command below should show help:

```bash
agenda-intelligence --help
```

## 2. Pick a source plan

For this demo, we use the **technology‑AI** plan. This tells the tool which source files to pull and how to combine them.

```bash
agenda-intelligence source-plan technology-ai
```

The output lists all the `*definition.json` files that will be fed into the evidence pack.

> **Tip:** You can view the plan definition in `source-requirements/technology-ai.json`.

## 3. Build a minimal evidence pack

For a copy-pasteable run, start from the bundled evidence-pack example:

```bash
cp examples/source/evidence-pack.json evidence-pack.json
```

That file follows `schemas/v1/evidence-pack.schema.json`: it contains a `topic`, `evidence_mode`, optional `source_category`, claim-level `sources`, `unsupported_claims`, and a `source_plan`. For your own analysis, keep the same structure and replace the claim/source content with your actual evidence.

## 4. Validate the evidence pack

```bash
agenda-intelligence validate-evidence evidence-pack.json
```

The CLI will load the plan, read the JSON, and emit a **validated** pack that you can feed to the brief generator.

## 5. Generate a brief

```bash
# The tool doesn't expose a direct brief generator, but you can use the
# `start` command to get a trimmed source plan together with a short
# JSON template that you can fill in.  E.g.,
agenda-intelligence start technology-ai > template.json
```

`template.json` will include the most critical `must_check` items and a short
`brief` scaffold:

```json
{
  "bottom_line": "<summary>",
  "signal_classification": "<noise|weak_signal|signal|structural_shift|trigger_event>",
  "signal_markers": ["<optional marker>"],
  "what_changed": "<what changed>",
  "main_uncertainty": "<main uncertainty>",
  "watch_next": ["<indicator 1>", "<indicator 2>"]
}
```

Copy‑paste that into a file your own name, e.g., `brief.json`, fill the fields, and you have a full agenda brief ready for validation.

## 6. Validate the brief

```bash
agenda-intelligence validate-brief examples/agenda-brief.json
```

A green check means the JSON conforms to the schema. Replace the example path with your own `brief.json` after you fill the template.

## 7. Score the brief

For a quick heuristic protocol check, run the **score** step:

```bash
agenda-intelligence score examples/before-after/eu-ai-act.md
```

The command runs the before/after evaluation harness for that example.

---

### Aha Moment

- You started from a *no‑code* point (just a Python install)
- Ran a **single CLI command** to list the source plan
- Sketched an evidence pack by hand
- Generated a **brief template** in one command, then filled and validated it
- Got instant **validation** and **heuristic scoring**.

All of this took under **10 minutes**—it shows how the protocol moves you from data collection straight to a decision‑ready artifact.

## Want a ready‑made demo? 🚀

Check the `examples/before-after/` folder in the repo and run another pre-assembled example:

```bash
agenda-intelligence score examples/before-after/sanctions-routing.md
```

You can also run:

```bash
agenda-intelligence score examples/before-after/red-sea-shipping.md
```

Enjoy the instant feedback loop!
