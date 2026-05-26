# CIS secondary-sanctions exposure — examples

Synthetic illustrative examples for the `cis_secondary_sanctions` vertical worker. Names are fabricated. No attribution to real undesignated entities.

## Contract fixtures

Each fixture pair under [contract/](contract/) validates against the v1 schemas:

- [`insufficient_information`](contract/insufficient_information.request.json) → [response](contract/insufficient_information.response.json): no sources supplied; triage returns `insufficient_information`.
- [`escalate_before_onboarding`](contract/escalate_before_onboarding.request.json) → [response](contract/escalate_before_onboarding.response.json): partial sources at onboarding; triage returns `escalate_before_onboarding` with `not_decision_ready`.
- [`ready_for_human_review`](contract/ready_for_human_review.request.json) → [response](contract/ready_for_human_review.response.json): full sources at periodic review; triage returns `ready_for_human_review` with `review_ready`.

Validate locally:

```bash
python3 -c "
import json
from pathlib import Path
from jsonschema import Draft202012Validator

root = Path('.')
req_schema = json.loads((root / 'schemas/v1/cis-secondary-sanctions-request.schema.json').read_text())
res_schema = json.loads((root / 'schemas/v1/cis-secondary-sanctions-response.schema.json').read_text())

for path in sorted((root / 'examples/cis-secondary-sanctions/contract').glob('*.request.json')):
    Draft202012Validator(req_schema).validate(json.loads(path.read_text()))
for path in sorted((root / 'examples/cis-secondary-sanctions/contract').glob('*.response.json')):
    Draft202012Validator(res_schema).validate(json.loads(path.read_text()))
print('OK')
"
```

## Live retrieval

Per [ADR 0014](../../docs/adr/0014-per-profile-live-retrieval.md), the `cis_secondary_sanctions` profile opts in to live retrieval against the OpenSanctions consolidated dataset (CC-BY 4.0). To enable it locally:

```bash
export OPENSANCTIONS_API_KEY=<free-key-from-https://www.opensanctions.org/api/>
```

To disable globally:

```bash
export OPENSANCTIONS_DISABLED=1
```

When disabled or unavailable, the service degrades gracefully: response includes `live_retrieval_status: degraded` (or `disabled`) and triage is based on user-supplied evidence only.

## Boundaries

- Pre-compliance evidence triage only. Not legal / sanctions / compliance / financial / investment / insurance / trading advice.
- `human_review_required: true` in every response.
- `factual_verification: false` — a name match against a sanctions list is not legal-entity identity verification.
