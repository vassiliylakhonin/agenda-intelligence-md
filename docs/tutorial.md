# Quick‑start Tutorial

The goal of this guide is to walk you through an entire *end‑to‑end* workflow that demonstrates the real‑world power of the Agenda Intelligence protocol in just 5‑10 minutes. By the end you will have produced a **decision‑ready brief** from scratch, validated it, and run a quick quality score.

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

> **Tip:** You can view the plan definition in `source-requirements/technology‑ai.json`.

## 3. Build a minimal evidence pack

Create a temporary directory and copy the required source files:

```bash
mkdir my‑evidence
cp -r source-requirements/technology-ai/* my‑evidence/
```

Now produce a minimal `evidence-pack.json` that references the first source file (replace `<index>` with an actual file name, e.g., `tech‑release.json`):

```json
{
  "documents": [
    {
      "file": "my-evidence/<index>.json",
      "maturity": 0.3,
      "history": [],
      "source": "source-requirements"
    }
  ]
}
```

Save this as `evidence-pack.json` in your working directory.

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
  "what_changed": "<what changed>",
  "main_uncertainty": "<main uncertainty>",
  "watch_next": ["<indicator 1>", "<indicator 2>"]
}
```

Copy‑paste that into a file your own name, e.g., `brief.json`, fill the fields, and you have a full agenda brief ready for validation.

## 6. Validate the brief

```bash
agenda-intelligence validate-brief brief.json
```

A green check means the JSON conforms to the schema.

## 7. Score the brief

For a quick quality check, run the **score** step:

```bash
agenda-intelligence score --brief brief.json --evidence evidence-pack.json
```

Output is a short numeric value (`0‑100`) and a short commentary on what could be improved.

---

### Aha Moment

- You started from a *no‑code* point (just a Python install)
- Ran a **single CLI command** to list the source plan
- Sketched an evidence pack by hand
- Generated a **complete JSON brief** in one command
- Got instant **validation** and **quality scoring**.

All of this took under **10 minutes**—it shows how the protocol moves you from data collection straight to a decision‑ready artifact.

## Want a ready‑made demo? 🚀

Check the `examples` folder in the repo, or pull a pre‑assembled evidence pack from the `sample‑data` directory:

```bash
cp -r example-data/technology-ai/ compiled-pack/  # includes evidence, plan, and brief
```

Then run:

```bash
agenda-intelligence score --brief compiled-pack/brief.json --evidence compiled-pack/evidence-pack.json
```

Enjoy the instant feedback loop!
