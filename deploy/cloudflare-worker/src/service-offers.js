// Human-delivered work is scoped before agreement. These are test offers,
// separate from metered APIs; no order, invoice or upload is created here.
export function serviceOffersHtml(escape, email, repository) {
  const brief = 'Task / current assignment:\nResponsible owner and audience:\nDeadline:\nExisting purchase route and budget owner:\nPermitted source pack (describe only; no confidential attachments yet):\nRequired output and acceptance criteria:\n';
  const contact = name => 'mailto:' + email + '?subject=' + encodeURIComponent(name + ' — scope request') + '&body=' + encodeURIComponent(brief);
  const samples = repository + '/tree/main/examples/service-engagement';
  return `<section id="scoped-services" aria-label="Work with a person"><h2>Need a finished piece of work?</h2>
  <p>Start with one defined assignment, an accountable reviewer and agreed acceptance criteria. These are service offers to test, not validated customer outcomes. Scope, availability and price require a written quote; an API payment does not buy these services.</p>
  <div class="card"><h3>Project Document Desk</h3>
  <p>For transport and infrastructure project teams: one evidence-structured draft or review of your own proposal against its tender and credential pack.</p>
  <p>You receive an editable draft, requirements matrix, source and calculation locators, open questions and one agreed revision. A named expert verifies and signs off the result.</p>
  <p>Indicative test basis: €450 per expert-day, up to five days (€2,250 cap), subject to scope. Document format and volume are agreed first.</p>
  <a href="${escape(contact('Project Document Desk'))}">Describe one assignment</a> · <a href="${escape(samples + '/project-document-sample.md')}">Read the synthetic sample</a></div>
  <div class="card"><h3>Agent Workflow Acceptance</h3>
  <p>For AI teams and integrators: implement and check one research or document workflow in your current stack.</p>
  <p>You receive agreed acceptance cases, reproducible failures, one bounded adapter or repair, regression checks and an operator handover. Semantic review and action authorization are explicit parts of scope where needed.</p>
  <p>Indicative test range: $1,500–3,000 per bounded sprint. Ongoing support is quoted only after the first accepted job; no unlimited integrations or 24-hour SLA.</p>
  <a href="${escape(contact('Agent Workflow Acceptance'))}">Describe one workflow</a> · <a href="${escape(samples)}">Inspect the acceptance sample and scope</a></div>
  <div class="card"><h3>Supplier Evidence Desk</h3>
  <p>For procurement and onboarding teams: prepare one supplier's document pack, assign evidence requests and compare updates.</p>
  <p>The browser workspace includes source attachments, an editable checklist, owner request tracking, saved versions and review exports. Dossier contents stay on your device; complete JSON backups carry the files and history. A person reviews authenticity and decides whether to onboard.</p>
  <a href="https://agendamcp.dpdns.org/supplier-desk">Open the free supplier workspace</a> · <a href="${escape(contact('Supplier Evidence Desk'))}">Scope a dossier preparation assignment</a></div>
  <p>Source authenticity, factual judgment, legal decisions and final submission remain with the responsible person. Describe the task first; agree a permitted transfer channel before sharing confidential materials.</p></section>`;
}
