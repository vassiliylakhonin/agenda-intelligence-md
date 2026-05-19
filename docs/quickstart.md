# Quickstart — End‑to‑End “Aha” Moment

This guide walks you through a **complete workflow** in about 10 minutes using the `technology‑ai` source plan.  
You will go from a fresh install to a validated, scored brief plus a scored
before/after example — the moment the protocol “clicks”.

## Prerequisites

* Python 3.9+ environment (virtualenv, conda, etc.)
* `pip` (or `git` to clone the repo)
* Internet access only if you choose the PyPI or GitHub install path

---

## 1️⃣ Install the package

```bash
# From PyPI (recommended)
pip install agenda-intelligence-md

# Or, editable install from source
git clone https://github.com/vassiliylakhonin/agenda-intelligence-md
cd agenda-intelligence-md
pip install -e .
```

Verify the CLI works:

```bash
agenda-intelligence --help
```

---

## 2️⃣ Get the source plan & brief template

The **`start`** command is the fastest way to onboard:

```bash
agenda-intelligence start technology-ai
```

**What you’ll see:**

```text
=== Trimmed source plan ===
{
  "must_check": ["tech-release", "policy‑update", "market‑data"],
  "watch_indicators": ["regulation draft", "enforcement action"]
}

=== Brief template (fill in) ===
{
  "bottom_line": "<summary>",
  "signal_classification": "<noise|weak_signal|signal|structural_shift|trigger_event>",
  "signal_markers": ["<optional marker>"],
  "what_changed": "<what changed>",
  "main_uncertainty": "<main uncertainty>",
  "watch_next": ["<indicator 1>", "<indicator 2>"]
}
```

Copy the template into a file, e.g. `brief.json`, and fill in the fields with your actual findings.

Use `signal_classification` for signal strength and `signal_markers` for
practical qualifiers:

```json
{
  "signal_classification": "signal",
  "signal_markers": ["compliance_relevant_development"]
}
```

Marker values such as `compliance_relevant_development`,
`enforcement_marker`, and `escalation_marker` remain valid in
`signal_classification` for backward compatibility, but new examples should use
`signal_markers`.

> **Tip:** The source plan tells you exactly which files under `source-requirements/technology-ai.json` you should consult before making claims.

---

## 3️⃣ (Optional) Validate an evidence pack

If you want to validate that every claim is backed by a source, start from the bundled runnable example:

```bash
cp examples/source/evidence-pack.json evidence-pack.json
```

The example follows `schemas/evidence-pack.schema.json`: it has a `topic`, an `evidence_mode`, optional `source_category`, claim-level `sources`, `unsupported_claims`, and a `source_plan`.

Validate it:

```bash
agenda-intelligence validate-evidence evidence-pack.json
```

---

## 4️⃣ Validate the brief

```bash
agenda-intelligence validate-brief examples/agenda-brief.json
```

A green check means the JSON conforms to the schema and all required fields are present. Replace the example path with your own `brief.json` after you fill the template.

---

## 5️⃣ Score the brief (heuristic protocol check)

```bash
agenda-intelligence score examples/agenda-brief.json
```

You’ll get a heuristic 0‑100 protocol score with dimension feedback for structure, evidence discipline, and decision-readiness signals.
It does not verify factual truthfulness.

---

## 6️⃣ Add evidence-pack scoring

```bash
agenda-intelligence score examples/agenda-brief.json --evidence examples/source/evidence-pack.json
```

This adds claim-level evidence feedback: supported claims, unsupported claims,
missing sources, contradicting sources, and source-backed mode hygiene.

---

## 7️⃣ Score a before/after example

```bash
agenda-intelligence score examples/before-after/eu-ai-act.md
```

You’ll get the before/after evaluation harness output for that example. The
before/after scorer checks protocol markers such as signal classification,
uncertainty, falsifiability, and watch-next indicators.

---

## ✨ Aha Moment Recap

| Step | What you did | Why it matters |
|------|---------------|----------------|
| 1 | Installed the package | One‑liner, no prior knowledge needed |
| 2 | Ran `start technology‑ai` | Got a trimmed source plan + ready‑to‑fill brief template |
| 3 | (Optional) Built an evidence pack | Ensures every claim is source‑backed |
| 4 | Validated the brief | Confirms structural correctness |
| 5 | Scored the brief | Checks decision-readiness signals |

**Total time:** < 10 minutes.  
**Result:** You’ve turned raw source requirements into a **decision‑ready brief** that explicitly lists watch‑next indicators — no generic “monitor developments” fluff.

---

## Next steps

- Explore more source plans: `agenda-intelligence source-plan sanctions`, `agenda-intelligence source-plan conflict-security`, etc.
- Read the full [tutorial](tutorial.md) for a deeper dive.
- Check [example briefs](../examples/) to see the protocol in action.
- See the [evaluation rubric](../evals/rubric.md) to understand how the heuristic score is computed.

> **Bottom line:** The protocol forces the agent (or you) to answer *what changed, why it matters, who is affected, and which three indicators to watch*. That’s the “aha” moment.
