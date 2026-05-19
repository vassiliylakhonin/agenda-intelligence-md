# Source Plan Coverage Boundary

Source Plans describe which source types should be checked before strengthening a claim. They are a source-discipline contract, not source retrieval, source discovery, or factual verification.

## Current Contract

Implemented today:

- `source-plan <category>` prints required and recommended source types for an analysis category.
- `source-categories` lists packaged category IDs before selecting a source plan.
- MCP `source_plan` returns the same packaged source requirement pack.
- MCP `list_source_categories` returns the same category discovery list.
- `source-coverage <evidence.json> --category <category>` reports covered and missing required source types.
- Evidence packs may set optional `source_category` so `source-coverage <evidence.json>` can select the packaged source plan without a separate CLI/MCP category argument.
- MCP `source_coverage` returns the same diagnostic structure.
- Coverage output includes `required_source_details`, which shows matched source entries and matched terms for each required source type.
- Evidence packs may list `source_plan` notes and unsupported claims.
- Scoring and review can surface weak evidence discipline.

Not implemented today:

- automatic source discovery;
- schema failure when a `must_check` source type is absent.

## Missing Required Source

A Missing Required Source is a source type from a Source Plan that was required or expected but was not available in the evidence pack.

Before v1.0, this is a diagnostic gap, not a schema error. The right behavior is to make the gap visible:

- disclose it in `unsupported_claims` or source notes;
- weaken the claim if the missing source is load-bearing;
- downgrade `evidence_mode` when live source access was not available;
- use `mixed` when some claims are source-backed and others rely on user-provided or reasoning-only evidence;
- route the case to analyst review when the missing source affects a decision.

Run:

```bash
agenda-intelligence source-categories --format json
agenda-intelligence source-coverage evidence.json --category sanctions
agenda-intelligence source-coverage evidence.json
agenda-intelligence source-coverage evidence.json --category sanctions --format json
agenda-intelligence source-coverage evidence.json --category sanctions --strict
```

Without `--strict`, missing coverage exits 0. With `--strict`, missing required source coverage exits 1 so teams can opt into a CI gate.

The JSON output is intentionally explainable: each required source type has a status (`covered`, `missing`, or `explicitly_missing`) and the source entries that matched it. These matches explain why the diagnostic counted a source type as present; they do not prove the cited source is correct or sufficient.

## Sanctions Claim Example

For a sanctions claim such as "Company X is sanctioned worldwide," the sanctions Source Plan expects source types such as:

- official sanctions list;
- legal text or legal instrument;
- regulator guidance;
- license or general authorization where relevant.

If an evidence pack cites media commentary but lacks official list evidence, that is a Missing Required Source. The toolkit should not say the claim is true or false in the world, and `validate-evidence` should not fail solely because the official list is missing. The brief should instead mark the sanctions claim as unsupported or partially supported, explain the missing source, and avoid the worldwide claim until jurisdiction scope, aliases, dates, and ownership/control evidence are checked.

## Strict Gate

`--strict` checks whether evidence packs cover required source types for a selected category. It remains separate from base schema validation:

- `validate-evidence` answers whether the evidence pack shape is valid.
- source-plan coverage answers whether category-specific source expectations were met.
- factual verification answers whether the claim is true in the world.

Keeping these questions separate prevents schema validity from being mistaken for source completeness or truth.
