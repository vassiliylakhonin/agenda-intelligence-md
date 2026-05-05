# Quickstart — End‑to‑End “Aha” Moment

This guide walks you through a **complete workflow** in about 10 minutes using the `technology‑ai` source plan.  
You will go from a fresh install to a validated, scored brief — the moment the protocol “clicks”.

## Prerequisites

* Python 3.9+ environment (virtualenv, conda, etc.)
* `pip` (or `git` to clone the repo)
* Internet access (to fetch source definitions)

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
  "must_check": ["tech‑release", "policy‑update", "market‑data"],
  "watch_indicators": ["regulation draft", "enforcement action"]
}

=== Brief template (fill in) ===
{
  "bottom_line": "<summary>",
  "signal_classification": "<noise|weak_signal|signal|structural_shift|trigger_event>",
  "what_changed": "<what changed>",
  "main_uncertainty": "<main uncertainty>",
  "watch_next": ["<indicator 1>", "<indicator 2>"]
}
```

Copy the template into a file, e.g. `brief.json`, and fill in the fields with your actual findings.

> **Tip:** The source plan tells you exactly which files under `source‑requirements/technology‑ai/` you should consult before making claims.

---

## 3️⃣ (Optional) Build an evidence pack

If you want to validate that every claim is backed by a source, create a minimal evidence pack:

```bash
mkdir my‑evidence
cp -r source‑requirements/technology‑ai/* my‑evidence/
```

Then create `evidence‑pack.json`:

```json
{
  "documents": [
    {
      "file": "my‑evidence/tech‑release.json",
      "maturity": 0.3,
      "history": [],
      "source": "source‑requirements"
    }
  ]
}
```

Validate it:

```bash
agenda‑intelligence validate‑evidence evidence‑pack.json
```

---

## 4️⃣ Validate the brief

```bash
agenda‑intelligence validate‑brief brief.json
```

A green check means the JSON conforms to the schema and all required fields are present.

---

## 5️⃣ Score the brief (quality check)

```bash
agenda‑intelligence score --brief brief.json --evidence evidence‑pack.json
```

You’ll get a numeric score (0‑100) and a short comment on what could be improved.

---

## ✨ Aha Moment Recap

| Step | What you did | Why it matters |
|------|---------------|----------------|
| 1 | Installed the package | One‑liner, no prior knowledge needed |
| 2 | Ran `start technology‑ai` | Got a trimmed source plan + ready‑to‑fill brief template |
| 3 | (Optional) Built an evidence pack | Ensures every claim is source‑backed |
| 4 | Validated the brief | Confirms structural correctness |
| 5 | Scored the brief | Measures decision‑ready quality |

**Total time:** < 10 minutes.  
**Result:** You’ve turned raw source requirements into a **decision‑ready brief** that explicitly lists watch‑next indicators — no generic “monitor developments” fluff.

---

## Next steps

- Explore more source plans: `agenda‑intelligence source‑plan sanctions`, `source‑plan conflict‑security`, etc.
- Read the full [tutorial](tutorial.md) for a deeper dive.
- Check [example briefs](examples/) to see the protocol in action.
- See the [evaluation rubric](evals/rubric.md) to understand how quality is scored.

> **Bottom line:** The protocol forces the agent (or you) to answer *what changed, why it matters, who is affected, and which three indicators to watch*. That’s the “aha” moment.
