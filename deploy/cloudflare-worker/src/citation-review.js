// Browser source is kept literal to survive Wrangler's keepNames bundling.
// This prepares one caller-declared claim, never infers support or fetches a URL.
export const CITATION_REVIEW_SCRIPT = String.raw`
async function runCitationReview(event) {
  event.preventDefault();
  var status = document.getElementById('citation-status');
  var button = document.getElementById('citation-run');
  if (button.disabled || (document.getElementById('profile-run').disabled && !agendaTrialBlocked)) {
    status.textContent = 'A check is already running. Wait for its response.';
    return;
  }
  var claim = document.getElementById('citation-claim').value;
  var source = document.getElementById('citation-source').value;
  var quote = document.getElementById('citation-quote').value;
  var support = document.getElementById('citation-support').value;
  if (!claim.trim() || !source.trim() || !['direct', 'partial', 'weak', 'unsupported'].includes(support)) {
    status.textContent = 'Add an assertion, its source excerpt and your assessment of its support before checking.';
    return;
  }
  var item = {claim_id:'claim-1', claim:claim, support_level:support, evidence_ids:['source-1']};
  if (quote.trim()) item.supporting_quotes = [{evidence_id:'source-1', quote:quote}];
  var packet = {topic:'One-claim citation review', claims:[item],
    evidence:[{evidence_id:'source-1', source_type:'user_provided', content:source}]};
  document.getElementById('profile-request').value = JSON.stringify(packet, null, 2);
  var editor = document.getElementById('profile-intake');
  if (editor && editor.updateFromJson) editor.updateFromJson();
  button.disabled = true;
  try {
    await runProfileExample(event, false, 'one-claim-v1');
    status.textContent = document.getElementById('profile-status').textContent.replace(/ Trace: .*$/, '');
  } finally { button.disabled = false; }
}
`;

export function citationReviewHtml(attempts, allowancePanel) {
  return `<section id="one-claim-review" aria-label="Review one claim">
    <h2>Check one claim before sharing an AI answer</h2>
    <p>Paste one assertion from your answer and the actual source excerpt. Add the exact quote you want checked, if any. Text and quotes are preserved as supplied. This checks citation structure and quote presence; a reviewer must decide whether the source supports the meaning.</p>
    ${allowancePanel}
    <form onsubmit="runCitationReview(event)">
      <p><label for="citation-claim">Assertion from the AI answer</label><br><textarea id="citation-claim" rows="3" required style="width:100%;font:inherit;padding:8px"></textarea></p>
      <p><label for="citation-source">Original source excerpt</label><br><textarea id="citation-source" rows="5" required style="width:100%;font:inherit;padding:8px"></textarea></p>
      <p><label for="citation-quote">Exact supporting quote, if present in the answer (optional)</label><br><textarea id="citation-quote" rows="2" style="width:100%;font:inherit;padding:8px"></textarea></p>
      <p><label for="citation-support">How do you assess the source's support?</label><br>
      <select id="citation-support" required style="font:inherit;padding:8px"><option value="">Choose your assessment</option><option value="direct">Direct</option><option value="partial">Partial</option><option value="weak">Weak</option><option value="unsupported">Unsupported</option></select><br>
      <small>Your assessment is recorded as your claim, not independently verified.</small></p>
      <button id="citation-run" type="submit" class="primary-action primary-action-main">Check this claim free</button>
      <p id="citation-status" role="status"></p>
    </form>
    <p>This uses one of the same ${attempts} campaign attempts per network. Only the claim entered here is checked. Do not submit confidential material. After a result, correct the assertion or quote and check again; the result and optional feedback appear below. <a href="#profile-console">Review several claims with the full request form</a>.</p>
  </section>`;
}
