# Contributing to Agenda Intelligence

## First 15 minutes

If you've just landed in this repo and want to understand it before editing, do these in order. Each step is real-time-boxed at ~5 minutes.

**1. Read these three files, in order:**

1. [`README.md`](README.md) — what this is (product shell + evidence-discipline layer), the four-repo stack, and the non-goals (no live retrieval, no factual verification).
2. [`AGENTS.md`](AGENTS.md) — canonical project rules: identity, geography routing terms, honesty rules, retrieved-content trust. Everything else in this file inherits from there.
3. [`ROADMAP.md`](ROADMAP.md) — what's shipping vs explicitly deferred. The version targets here are how this repo signals maturity (this repo does **not** use the Bar 1 / Bar 2 framework — that belongs to the vertical specialists).

**2. Get the validator running locally:**

```bash
git clone https://github.com/vassiliylakhonin/agenda-intelligence-md
cd agenda-intelligence-md
make install                  # editable install + lint/type tooling
bash scripts/install-hooks.sh # pre-push hook running `make ci-fast`
pytest                        # full test suite
make ci-fast                  # what CI will run on your push
```

If `make ci-fast` is green locally, your push will not red-CI on `main`.

**3. Read one concrete artifact end-to-end:**

- [`examples/agenda-brief.json`](examples/agenda-brief.json) → [`schemas/agenda-brief.schema.json`](schemas/agenda-brief.schema.json) → run `agenda-intelligence validate-brief examples/agenda-brief.json`. This is the smallest complete loop the product shell exposes: a structured brief, the schema it conforms to, the validator that enforces it.
- For the MCP product surface: skim [`AGENTS.md`](AGENTS.md) "Geography routing" and the four product tools (`analyze`, `validate_memo`, `list_signals` / `get_signal`, `deep_dive`).

**Unfamiliar with a term in `AGENTS.md`?** See the [portfolio glossary](docs/glossary.md) — single source of truth for evidence modes, uncertainty labels (`Verified`/`Plausible`/`Judgment`/`Unknown`), table-cell discipline, Axis A/B provenance tags, three-value response logic, and the deliberate maturity-framework asymmetry across the four repos (Bar 1/2 ≠ Maturity framework ≠ ROADMAP versioning).

**When something is unclear**, the lookup order is: this repo's [`AGENTS.md`](AGENTS.md) → portfolio canon ([global-think-tank-analyst/AGENTS.md](https://github.com/vassiliylakhonin/global-think-tank-analyst/blob/main/AGENTS.md), vertical-skill AGENTS.md files) → open an issue using the template under [`.github/ISSUE_TEMPLATE/`](.github/ISSUE_TEMPLATE/).

**Before your first PR**, the single most common reason CI breaks on `main` for new contributors is the **dual-copy invariant** — read the "Critical invariant: dual-copy sync" section below before editing any of the listed files.

---

## Project Philosophy
- **Markdown is the source of truth.** All documentation, specifications, and examples live in Markdown files.
- **Python tooling** provides validation, generation, and integration. Keep the Python layer lightweight and focused on the protocol.
- **Avoid framework bloat.** The project should stay a simple, composable protocol, not a heavy framework.

## Development Setup
```bash
git clone https://github.com/vassiliylakhonin/agenda-intelligence-md
cd agenda-intelligence-md
make install                  # editable install + lint/type tooling
bash scripts/install-hooks.sh # strongly recommended: pre-push hook running `make ci-fast`
                              # skipping this leads to fix-CI-fix-CI commit chains
pytest
```

## Pre-push gate
`make ci-fast` mirrors the GitHub `Lint` and `CI` workflows:

```bash
make ci-fast   # flake8 + black --check + isort --check + ruff + mypy + pytest
make ci        # full surface, also runs CLI smoke + scripts/validate*.py
make format    # auto-fix black + isort
```

Run `make ci-fast` (or install the hook) before every push to avoid the
staircase of fix-CI-fix-CI commits. Bypass the hook in emergencies with
`git push --no-verify`.

## Validation Commands
```bash
agenda-intelligence validate-manifest
agenda-intelligence validate-brief examples/agenda-brief.json
agenda-intelligence validate-evidence examples/source/evidence-pack.json
```

## Critical invariant: dual-copy sync

> **Read this before editing any of the files listed below.** Editing one copy without the other is the most common reason CI breaks on `main` for first-time contributors.

The repo keeps two copies of several files — top-level AND under `src/agenda_intelligence/data/`. Both copies must stay in sync or CI fails (enforced by `tests/test_package_consistency.py`):

- `Agenda-Intelligence.md` ↔ `src/agenda_intelligence/data/Agenda-Intelligence.md`
- `SOURCE_POLICY.md` ↔ `src/agenda_intelligence/data/SOURCE_POLICY.md`
- `llms.txt` ↔ `src/agenda_intelligence/data/llms.txt`
- `agent-manifest.json` ↔ `src/agenda_intelligence/data/agent-manifest.json`
- `schemas/*.json` ↔ `src/agenda_intelligence/data/schemas/*.json`
- `skills/**` ↔ `src/agenda_intelligence/data/skills/**`
- `source-requirements/*` ↔ `src/agenda_intelligence/data/source-requirements/*`

When editing any of these, update the paired copy in the same commit. Version bumps must propagate to packaged copies or release CI fails.

## Adding Schemas
- Preserve backward‑compatibility where possible.
- Add both **valid** and **invalid** fixtures.
- Update the test suite to cover new cases.

## Adding Lens Packs
- Keep lenses concise and focused on failure modes and watch‑next indicators.
- Update the manifest if a new lens pack is required.

## Adding Examples
- Clearly label synthetic or demo examples.
- Do not claim live verification unless the sources were actually retrieved.
- Include a source plan and evidence pack when relevant.

## Evaluation Policy
- Heuristic scoring measures adherence to the protocol, **not** truthfulness of the content.

## Pull Request Checklist
- [ ] `make ci-fast` passes locally (`flake8`, `black --check`, `isort --check`, `mypy`, `pytest`)
- [ ] `make format` run if any Python files were touched
- [ ] `python -m compileall .` passes
- [ ] CLI validation commands succeed (`validate-manifest`, `validate-brief`, `validate-evidence`)
- [ ] If any dual-copy file was edited: paired copy in `src/agenda_intelligence/data/` updated in the same commit
- [ ] Version bump propagated to both top-level and `src/agenda_intelligence/data/` copies
- [ ] `CHANGELOG.md` updated under `Unreleased` when behavior or schema changes
- [ ] Documentation updated when behavior changes