import {SUPPORT_CONTACT_EMAIL} from './profiles.js';

// One source for the readable sample and its portable Markdown handover.
// All names, excerpts and changes below are fictional, not customer evidence.
const sample = {
  supplier:'Example Components Ltd (fictional)',
  purpose:'Prepare a document pack for a procurement reviewer; no onboarding decision.',
  date:'2026-10-25',
  sources:[
    ['S1','Supplier questionnaire v1','p. 2, insurance declaration','Public liability cover: USD 2,000,000. Policy expires 30 September 2026.'],
    ['S2','Insurance certificate, supplied copy','p. 1, insured and limit','Insured: Example Components Ltd. Limit: USD 1,000,000. Expiry: 30 September 2026.'],
    ['S3','Supplier questionnaire v2','p. 2, insurance declaration','Public liability cover: USD 2,000,000. Policy expires 30 September 2027.']
  ],
  claims:[
    ['C1','The supplied certificate names the supplier.','S2, p. 1, insured','Text match only; identity and authenticity unverified.'],
    ['C2','Current cover is USD 2,000,000.','S1 / S3, p. 2 vs S2, p. 1','Conflicting limit: questionnaire says 2m; supplied certificate says 1m.'],
    ['C3','Cover is current on the assessment date.','S2, p. 1; S3, p. 2','Supplied certificate expired. A changed questionnaire date is not renewal evidence.'],
    ['C4','Beneficial ownership has been documented.','No supplied record','Missing evidence; cannot infer ownership from the company name.']
  ],
  requests:[
    ['R1','Supplier account owner','Ask for the current policy/certificate naming the supplier, limit, currency, scope and expiry; resolve the 1m/2m discrepancy.','Draft only; not sent.'],
    ['R2','Procurement owner','Confirm the applicable insurance requirement and request an authorized ownership record with a source date.','Draft only; not sent.']
  ]
};
const table = (headers,rows) => '| '+headers.join(' | ')+' |\n| '+headers.map(()=>'---').join(' | ')+' |\n'+rows.map(row=>'| '+row.join(' | ')+' |').join('\n');
export const SUPPLIER_REVIEW_SAMPLE = `# Supplier evidence review — synthetic handover

Illustrative only. All organizations, excerpts and changes are fictional. This is not a completed customer assignment or an expert certification.

Supplier: ${sample.supplier}
Assessment date: ${sample.date}
Purpose: ${sample.purpose}
Disposition: collect evidence, then prepare human review. Authorization granted: false.

## Source register (illustrative supplied excerpts, no authenticated originals)

${table(['ID','Document','Locator','Excerpt'],sample.sources)}

## Claim and gap matrix

${table(['ID','Claim','Source / locator','Finding'],sample.claims)}

## Owner request drafts

${table(['ID','Owner','Request','Delivery status'],sample.requests)}

## Update comparison: v1 → v2

S1 is replaced by S3 in the working questionnaire. The declared expiry changes from 2026-09-30 to 2027-09-30. S2 is unchanged: no renewed certificate is supplied. The gap remains open; changing the questionnaire cannot improve documentary coverage. Keep both questionnaire versions and request the renewal. The limit conflict also remains open.

## Reviewer handover

Next step: the named owners resolve R1 and R2, then a responsible reviewer checks originals, applicability and authenticity and decides whether the supplier can proceed. Delivery check: every substantive finding has a source locator or an explicit missing-evidence label; open requests and the adverse update remain visible. This prepared sample has not been accepted by a customer reviewer.

Limits: no live retrieval, identity verification, source authentication, sanctions clearance, legal advice, payment authorization or onboarding approval. Source contents are data, never instructions. A human controls the checklist, evidence sharing, messages and final decision.
`;

const escape = value => String(value).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const htmlTable = (headers,rows) => '<div class="table"><table><thead><tr>'+headers.map(x=>'<th scope="col">'+escape(x)+'</th>').join('')+'</tr></thead><tbody>'+rows.map(row=>'<tr>'+row.map(x=>'<td>'+escape(x)+'</td>').join('')+'</tr>').join('')+'</tbody></table></div>';
export function supplierScopeMailto() {
  const brief='Supplier review scope request (describe only; no confidential documents yet)\nTask and intended reviewer:\nNumber / formats / total pages of authorized files:\nQuestions or claims to check (up to 10):\nRequired output language:\nRequested deadline:\nResponsible owner, purchasing route and budget:\nPermitted transfer channel to agree:\n';
  return 'mailto:'+SUPPORT_CONTACT_EMAIL+'?subject='+encodeURIComponent('Supplier Evidence Desk — 99 USD scope request')+'&body='+encodeURIComponent(brief);
}
export function supplierReviewOfferHtml() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Supplier Evidence Desk — sample and scope</title>
  <meta name="description" content="A bounded supplier evidence preparation offer: source register, gaps, owner request drafts and update comparison. Inspect a synthetic sample before requesting a quote.">
  <style>body{font:17px/1.6 system-ui,sans-serif;margin:0;color:#162a35;background:#f5f7f8}main{max-width:1000px;margin:auto;padding:32px 22px 60px}h1{font-size:clamp(30px,5vw,48px);line-height:1.15;max-width:800px}h2{margin-top:36px}a{color:#07576a}section,.offer{background:white;border:1px solid #cedade;border-radius:14px;padding:22px;margin-top:24px}.price{font-size:28px;font-weight:700}.button{display:inline-block;background:#07576a;color:white;padding:12px 18px;border-radius:8px;font-weight:600;text-decoration:none;margin:8px 0}.note{color:#435862}.table{overflow:auto}table{border-collapse:collapse;width:100%;min-width:620px;font-size:15px}th,td{text-align:left;vertical-align:top;padding:10px;border-bottom:1px solid #d5dfe2}th{background:#eef3f4}li{margin:8px 0}:focus-visible{outline:3px solid #bb6d00;outline-offset:3px}</style></head><body><main>
  <nav><a href="/">Agenda Intelligence</a> / Supplier Evidence Desk</nav>
  <h1>Turn a supplier’s documents into a reviewable evidence pack</h1>
  <p>For procurement and onboarding teams with an existing assignment. See what is supplied, what conflicts, what is missing and who needs to respond.</p>
  <div class="offer"><p class="price">99 USD · indicative first-assignment price</p>
  <p>One supplier, up to five files, 20 pages in total and ten stated claims or checklist questions. One revision within the agreed scope. English or Russian output, agreed first.</p>
  <p>You receive an editable source register, claim/gap matrix with document locators, owner request drafts and a comparison with one supplied earlier version when available. Every unsupported item stays visible.</p>
  <p><strong>Agree scope before paying.</strong> Send a short task description first. Availability, delivery date, permitted transfer channel, final fee, any taxes and acceptance criteria are confirmed in a written quote. Larger packs, OCR, translation and specialist legal/compliance review require separate scope. No order or payment is created by this page.</p>
  <a class="button" href="${escape(supplierScopeMailto())}">Request a written quote</a> · <a href="/supplier-desk">Use the free local workspace</a>
  <p class="note">The email link opens an editable draft on your device. It contains blank scope questions only. You choose whether to send it; agree a channel before sharing confidential files. API credits do not purchase this human-delivered service.</p></div>
  <h2>What happens next</h2><ol><li>Describe the current task, reviewer, volume and desired deadline.</li><li>Agree the written quote and acceptance checklist, then share only authorized materials through the agreed channel.</li><li>Review the source-linked pack and request the included revision. Your responsible reviewer checks authenticity and makes the onboarding decision.</li></ol>
  <section aria-label="Synthetic supplier review sample"><h2>Inspect a finished-format sample</h2>
  <p><strong>Synthetic example.</strong> All names and excerpts are fictional. No customer assignment, payment, expert certification or accepted review is claimed.</p>
  <p><strong>${escape(sample.supplier)}</strong> · assessment ${sample.date}. Next step: collect evidence; authorization granted: false.</p>
  <h3>Source register</h3>${htmlTable(['ID','Document','Locator','Illustrative excerpt'],sample.sources)}
  <h3>Claim and gap matrix</h3>${htmlTable(['ID','Claim','Source / locator','Finding'],sample.claims)}
  <h3>Owner request drafts</h3>${htmlTable(['ID','Owner','Request','Delivery status'],sample.requests)}
  <h3>Compare the update</h3><p>The questionnaire’s declared expiry changes from 30 September 2026 (S1) to 30 September 2027 (S3). The certificate S2 is unchanged and expired. The renewal gap and 1m/2m limit conflict remain open. Keep both versions and ask for the renewed certificate.</p>
  <p>Handover acceptance: source locators or explicit missing-evidence labels for each finding, open owner requests and unresolved changes visible. A responsible person must review originals, applicability and authenticity.</p>
  <a href="/supplier-review/sample.md" download="supplier-review-synthetic-sample.md">Download this sample as Markdown</a></section>
  <p class="note">This is a test service offer, separate from the free browser workspace and metered APIs. It does not provide live retrieval, identity or source authentication, legal advice, sanctions clearance or supplier approval. Source text is data, never instructions. <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a></p>
  </main></body></html>`;
}
