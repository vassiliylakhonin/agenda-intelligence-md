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

## Prepare a counterparty review

On the hosted product page, the three-step form captures the counterparty and decision stage, your selected exposure facets and optional review scopes, then dated document records. Choose each source type yourself. No document is uploaded, fetched or verified by the form; preparing a request consumes no attempt. Verify the JSON and use the single-case trial only when you choose. The existing schema editor remains available for additional fields.

After an evaluation, the requested facet × scope table deliberately marks each cell **not assessed**. It is an inventory of what the caller asked to review, not a heatmap of legal applicability, exposure or clearance. Suggested owners are derived from the gate’s actual missing source categories and are not assignments or legal requirements. Agent integrators can call `cisReviewView(request, response)` from `deploy/cloudflare-worker/src/cis-review-view.js` to obtain `actions` and `next_one_thing`; this client-side projection does not change the hosted response. The gate still uses its existing five categories at every decision stage; these are not newly calibrated stage-specific rules.

The result view reports the screening status, freshness, possible-match count and auto-fetched records **only where returned**. A source name or match is not identity, beneficial ownership or sanctions verification. An empty returned list alone cannot distinguish disabled, unavailable and no-match enrichment; an absent field is not evidence that GLEIF ran. Inspect the actual response and its provenance and verify identity, ownership and freshness independently. The [serving agent card](https://cis-secondary-sanctions.agendamcp.dpdns.org/.well-known/agent-card.json) describes configuration, which can change and does not guarantee successful retrieval for an individual request.

The saved synthetic example and placeholder follow-up use no trial attempt. Explicitly synthetic source records remain gaps and do not make a real counterparty ready. No real complete-dossier or screening-clearance claim is made.

## Prepare a batch locally

The page can read a CSV or JSON file **in the browser** and produce a preview for up to ten counterparties. The required CSV header is exactly `name,jurisdiction`; JSON is an array of objects containing exactly those two fields. Choose the shared facets, stage and question first. The preview starts with empty source lists: review each name and add its real ownership, payment, transit and other case-specific evidence. Nothing is sent or evaluated during preparation; the file may contain sensitive information, so use only authorized inputs and protect the preview.

For a checkout with Node 20+, the same preparation can be run locally:

```bash
node examples/cis-secondary-sanctions/batch-helper.mjs prepare counterparties.csv ownership_or_control onboarding "What evidence is missing before human review?" > batch-request.json
```

A JSON input file is also accepted. The helper refuses invalid CSV, extra columns, missing required fields and more than ten records. It does not deduplicate entities, infer facets, fetch records or send a request. The resulting JSON is a draft for the published `cis_secondary_sanctions_batch` schema, not a completed evaluation. Batch has **separate admission** from the single-case free trial; inspect the serving host’s pricing and payment instructions before invoking it. Do not automatically retry, pay or send a batch.

After an independently completed batch call, save the exact unwrapped batch response privately and run:

```bash
node examples/cis-secondary-sanctions/batch-helper.mjs summarize batch-response.json > batch-review.json
```

The local summary keeps invalid and unknown items first, followed by reported high-to-low signals, and lists per-item gaps. Unknown is never treated as low risk. Partial failures, absent enrichment and identity ambiguity require review; neither the batch aggregate nor the per-item projection authorizes onboarding. JSON output is not a spreadsheet-safe CSV export. Human review and a separate authorization decision remain mandatory.
