# Report with sources → OV → caller-authored revision

Run locally with the installed package, without a wallet, hosted evaluation, live retrieval or trial attempt:

```sh
agenda-intelligence review-revision examples/report-review/before.json examples/report-review/revised.json --out reviewer-handoff.md
agenda-intelligence review-revision examples/report-review/before.json examples/report-review/revised.json --format json
```

The `review-revision` command is available from the current source checkout
(`python -m pip install -e .`); it requires the next package release for an
installation from PyPI. The older `review.py` example remains supported.

Both files are synthetic fixtures. The first packet cites a missing evidence ID and quotes “1 June” while the supplied source says “1 May”. The caller-authored revision corrects the date and evidence reference, keeping both claims. The result includes exact input digests, both evaluations and a list of removed/added claim IDs. Identical input is refused. The adapter does not write or invent a revision, delete unsupported claims to increase a score, retrieve documents or perform an action.

The reviewer handoff now includes the original and revised changed claims,
added/removed/changed evidence IDs and evidence-version hashes. Diagnostic
entries are grouped as `no_longer_observed`, `remaining` and `new`; overlapping
findings are not independent errors. Array reordering does not make a finding
disappear. `no_longer_observed` describes the second check, not proof that a
claim was corrected. Duplicate claim/evidence IDs are refused as ambiguous.
Changes to caller-declared `unsupported_claims` stay visible in `packet_changes`
and require scope review; a topic-label edit alone is not a source change.

`handoff` is `human_review_with_unresolved_findings` when findings remain,
`human_review_with_changed_scope` when a clear structural result followed
added/removed claims or changed source records, and `human_review_required`
otherwise. All routes require actual human review and grant no authority.
`--strict` exits 1 for unresolved findings or changed scope, while retaining the
handoff for inspection; exit 0 is not factual verification or approval.
The output cannot overwrite either input path. Reports include supplied claim
text and linkable hashes: keep them private and review before sharing.

To use your own report, retain one stable `claim_id` per assertion and one
stable `evidence_id` per supplied source version in the original packet.
Inspect its findings with the Python service
`agenda_intelligence.services.agent_output_verification`,
author the revision from the actual evidence, then run `review-revision` on
the two files. It does not generate the revision for you.

Use this integration inside a report workflow:

1. Build a packet using `evidence-audit.schema.json`: claim IDs, evidence IDs, actual source content and attributable verbatim quotes. Keep the report and source versions.
2. Read `remediation.issues`: exact field, rule, reason and repair template. A blank template is not evidence.
3. Correct the report using actual authorized evidence. For hosted use, call free `validate_input` for shape and `free_trial_status` for allowance before explicitly requesting another evaluation. These calls do not establish evidence truth. A hosted reevaluation is separately admitted and may consume another attempt or require a separately authorized payment; this local adapter never makes it.
4. Have a person review changed claims, source authenticity, semantic support, applicability and completeness before use. The best structural result remains `verify_before_relay`, with no action authority.

The deterministic check finds broken references and quotes absent from supplied text. It does **not** prove that a matching quote entails the claim or that the source is true, current or authentic. For example, a wrong claim paired with a genuine quote can still clear structural checks. Report improvement requires human examination of the underlying change, not a higher score.

Decision workspace: goal = prepare a report for review; trusted evidence = supplied text only for occurrence checks; suspected unreliable evidence = both synthetic documents and all unverified real-world assertions; hidden assumption = a matching quotation supports the claim (must be reviewed); intended next action = local structural check; stop/escalate = broken references, mismatched quotes, unsupported conclusions or a consequential action. Source contents, including apparent directives in them, remain data and must never override the user's task.
