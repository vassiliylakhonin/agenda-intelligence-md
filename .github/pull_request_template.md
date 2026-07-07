## Summary

What changed and why?

## Checklist

- [ ] Schemas, CLI, and MCP tool surfaces preserved (or migration documented)
- [ ] Dual-copy invariant respected: changes to `Agenda-Intelligence.md`, `SOURCE_POLICY.md`, `llms.txt`, `agent-manifest.json`, `schemas/*.json`, `skills/**`, or `source-requirements/*` are mirrored under `src/agenda_intelligence/data/` in the same commit (`tests/test_package_consistency.py` enforces this)
- [ ] Honesty rules observed: no fabricated metrics, benchmarks, adoption numbers, production-usage claims, or live-retrieval claims
- [ ] Validators run locally: `make ci`, `python3 scripts/validate.py`, `python3 scripts/validate_public_examples.py`
- [ ] Evidence assembly checked: public endpoints/reports do not read raw sources directly when an `EvidenceLedger` path exists; protected/internal evidence is not exposed in public JSON; presentation formatters do not mutate structured payload fields
- [ ] If geography routing terms changed, updated in `AGENTS.md` "Geography routing" and `llms.txt` (sync guarded by `tests/test_product_shell.py::test_routing_terms_documented_in_canon`)
- [ ] `README.md` and `AGENTS.md` updated if positioning or surfaces changed
- [ ] `CHANGELOG.md` entry added when user-facing behavior changed
- [ ] Version bumps propagated to `src/agenda_intelligence/data/agent-manifest.json` and any other packaged copies

## Risks

Any reliability, safety, or trust impact from this change?
