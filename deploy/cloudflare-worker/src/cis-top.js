// Verified top-of-page explainer for the cis_secondary_sanctions landing page.
// Every claim below is grounded in the request/response schemas
// (schemas/v1/cis-secondary-sanctions-*.schema.json), the source taxonomy
// (source-requirements/cis-secondary-sanctions.json), the trial terms
// (output-trial.js: WORKER_TRIAL_LIMIT = 2, WORKER_TRIAL_PATH = '/v1/trial'),
// the local stdio description (src/agenda_intelligence/mcp_stdio.py) and the
// deployment config (Snapshot upstream active; GLEIF ownership enrichment is
// gated on env.GLEIF_ENABLED per deployment, so its line below is conditional).
import { isEnabled as gleifEnabled } from './upstream_gleif.js';

export function cisTopHtml(env = {}) {
  const gleifLine = gleifEnabled(env)
    ? " Supply the counterparty's LEI and it also fetches the disclosed LEI record from GLEIF (the public LEI pool, CC0-1.0), including any disclosed direct or ultimate parent relationships published there, as an auto-fetched source. GLEIF covers disclosed relationships only, not hidden or multi-layer beneficial ownership, so attach your own dated ownership-chain records too."
    : '';
  return `<section class="card" aria-label="What this review is">
  <h2>Before you onboard this counterparty: is the file ready for compliance review?</h2>
  <p>You have one counterparty from Kazakhstan, Uzbekistan, Kyrgyzstan, Tajikistan, Turkmenistan, Georgia, Armenia, Azerbaijan or Moldova. Bring its name and jurisdiction, the exposure facets, dated source extracts, your risk question and the decision stage. The review returns:</p>
  <ul>
    <li>a triage recommendation: <code>ready_for_human_review</code>, <code>not_decision_ready</code>, <code>escalate_before_onboarding</code>, <code>escalate_before_transaction</code> or <code>insufficient_information</code></li>
    <li>a decision-readiness score (0-100): how complete the evidence pack is for human review (not approval, clearance or advice)</li>
    <li>exposure dimensions: what the supplied evidence supports</li>
    <li>evidence gaps: exactly which records are missing, such as legal identity, ownership chain or dated screening extracts</li>
    <li>the minimum sources before review: an OFAC SDN extract, an EU consolidated-list extract, ownership-chain evidence, bank-correspondent evidence, and transit or invoice evidence</li>
  </ul>
  <h3>What this does not do: read first</h3>
  <p>This is not a sanctions screen and not clearance. It does not say "sanctioned" or "clean", and it is not a compliance determination or legal, sanctions, compliance or financial advice. A name match is not identity verification. A complete file is not clearance. The response contract fixes <code>authorization_granted: false</code>; human review is required before any consequential action.</p>
  <h3>How it differs from a sanctions screen</h3>
  <ul>
    <li>A sanctions screen answers: "Is this name on a list?" One list, one name.</li>
    <li>This review answers: "Is my file ready for a human compliance review?" It checks legal identity, ownership and dated screening evidence, for EU / UK / UAE / Singapore enhanced due diligence against OFAC EO 14114, the EU sanctions package, UK OFSI and FATF / EAG typologies.</li>
  </ul>
  <p>You still need the separate list check and the separate legal review. This prepares the file for those checks; it does not replace them.</p>
  <h3>Hosted and local modes</h3>
  <ul>
    <li><strong>Hosted (this page):</strong> reviews your supplied evidence and also matches the counterparty name against a server-side public-list snapshot. A match is a possible string match, not identity verification or a determination.${gleifLine} Two free live attempts on your own input at <code>/v1/trial</code> per network address for this campaign; shared networks share the allowance and it does not reset daily. No wallet or HTTP adapter is needed for the trial. After the allowance, 0.01 USDC per paid check on Base.</li>
    <li><strong>Local stdio package:</strong> runs on user-supplied evidence only, with no live retrieval.</li>
  </ul>
  <h3>How to use it</h3>
  <ol>
    <li>Start with the company name and jurisdiction and confirm its legal identity. Registered identifiers (LEI, national BIN) help but are optional.</li>
    <li>Add the exposure facets, for example ownership or control, transit or re-export, correspondent banking.</li>
    <li>Attach dated sources, each with an id, source type, title and date, not "checked somewhere".</li>
    <li>Ask the risk question and name the decision stage: onboarding, periodic review, pre-transaction, post-alert, committee review.</li>
  </ol>
  <p>Try the saved example first: <a href="/?source=agenstry#worked-example" onclick="showWorkedExample(); return false;">Show a counterparty ownership example</a> uses fictional inputs and consumes no payment or trial attempt.</p>
  <p>Checking one claim from this file? Use <a href="https://output-verification.agendamcp.dpdns.org/">One-Claim Review</a>. Authorizing one agent action? Use <a href="https://vizier.agendamcp.dpdns.org/">Vizier</a>. This page prepares the file; a human decides.</p>
</section>`;
}
