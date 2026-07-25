@AGENTS.md

# Claude Code working rules

`AGENTS.md` is the canonical project contract — apply it, do not restate it. It points to the detail files, loaded when the task needs them:

- [docs/vertical-workers.md](docs/vertical-workers.md) — shipped workers, the artifact ladder, hard requirements for a new one.
- [docs/geography-routing.md](docs/geography-routing.md) — routing term sets; one of the two canon mirrors the routing guard checks.
- [docs/local-checks.md](docs/local-checks.md) — what to run before push, in what order, plus the dual-copy invariant.

Runtime skill contracts: [skills/agenda-intelligence/SKILL.md](skills/agenda-intelligence/SKILL.md) and [skills/source-ingest/SKILL.md](skills/source-ingest/SKILL.md).

## Before push

```
make ci
```

Sufficient for most changes — lint, typecheck, full test suite. Everything else, including which step failed and why, is in [docs/local-checks.md](docs/local-checks.md). Do not keep a second copy of that list here.

Two traps worth naming up front: `black --check` runs first in CI and fails the whole pipeline on formatting drift, and the dual-copy paths under `src/agenda_intelligence/data/` must change in the same commit as their top-level twins.

## Working style in this repo

Follow existing schema, CLI, and MCP patterns instead of inventing new ones. Additive changes are allowed without prior approval under the change-discipline rules in AGENTS.md — behind a stable contract, with a contract test and a CHANGELOG entry.

Breaking v1 schema changes, removing MCP tools, and renaming public HTTP endpoints or A2A profiles need an ADR and a version bump. The v1.0.x contract freeze (ADR 0003) is still in force.
