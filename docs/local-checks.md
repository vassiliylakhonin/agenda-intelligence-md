# Local checks before push

The single source for what to run locally. `AGENTS.md` and `CLAUDE.md` both point here rather than carrying their own copies of the list.

## Sufficient before most pushes

```
make ci
```

Runs lint, typecheck, and the full test suite — the same gates CI applies. Use `make verify-local` instead (it adds the Cloudflare Worker tests) when the change touches Worker, discovery, runtime, or validation-guard code.

## Lint order matters

CI's Lint job runs `black` first and fails the whole pipeline on any formatting drift:

```
black --check --line-length=120 src/ tests/ scripts/
```

If it fails, auto-fix with `black --line-length=120 src/ tests/ scripts/`.

`flake8` runs immediately after and catches what `black` leaves alone — most often long string literals in dict or tuple positions that `black` cannot split:

```
flake8 src/ tests/ scripts/ --max-line-length=120 --ignore=E203,W503
```

There is no auto-fixer for those. Reformat by hand (parenthesized string concatenation, a dedicated constant). Note that a locally configured `flake8` can suppress `E501`; verify line length with Python if a long line is suspected.

## Contract validators

```
python3 -m agenda_intelligence.cli validate-manifest
python3 -m agenda_intelligence.cli validate-brief examples/agenda-brief.json
python3 -m agenda_intelligence.cli validate-evidence examples/source/evidence-pack.json
python3 scripts/validate.py
python3 scripts/validate_public_examples.py
```

`scripts/validate.py` carries hardcoded README and SKILL.md tokens (a hero substring, identity claims). Editing those strings breaks it, and the validator itself must be updated in the same change.

## MCP smoke check

```
python3 -m agenda_intelligence.cli doctor --mcp-command "python3 -m agenda_intelligence.mcp_stdio" --strict
```

## Dual-copy invariant

Packaged data under `src/agenda_intelligence/data/` mirrors top-level files: `Agenda-Intelligence.md`, `SOURCE_POLICY.md`, `llms.txt`, `agent-manifest.json`, `schemas/v1/*.json`, `skills/**`, `source-requirements/*`.

Change the paired copy in the same commit. `tests/test_package_consistency.py` enforces this, and version bumps in particular must propagate to the packaged copies or release CI fails.

## Hosted protocol contracts

`make verify-local` includes `tests/test_worker_runtime_contracts.py`. It invokes the real MCP handlers for every published schema-backed tool and both CIS/Dual-Use REST routes, then validates results using Draft 2020-12. All 20 hosted Agenda MCP tools publish outputSchema. Financial Guard and Escrow schemas describe both direct service responses and legacy A2A task envelopes; refused legacy calls set isError=true. Error-shaped refusals remain errors, rather than successful output contracts.
