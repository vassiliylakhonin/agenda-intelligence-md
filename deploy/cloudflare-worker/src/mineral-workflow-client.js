// Local page memory only. Preparing a revision performs no request or evaluation.
export const MINERAL_WORKFLOW_CLIENT_SCRIPT = String.raw`
var agendaMineralSubmission = null;
function renderMineralWorkflow(review, submitted) {
  var panel = document.getElementById('mineral-workflow');
  var flow = review.dossier_review && review.dossier_review.evidence_workflow;
  if (!panel || !flow) return;
  agendaMineralSubmission = JSON.parse(JSON.stringify(submitted));
  delete agendaMineralSubmission.previous_submission;
  panel.hidden = false;
  var html = '<h3>Evidence before this action</h3><p>' + safeHtml(flow.decision.question) +
    ' — ' + safeHtml(flow.decision.project_name) + ' (' + safeHtml(flow.decision.stage) + ')</p>';
  html += '<p>Documentary next step: ' + safeHtml(flow.documentary_next_step) +
    '. Human review remains required. Check the returned operational decision for screening blocks.</p>';
  flow.evidence_requests.forEach(function(item) {
    html += '<details><summary>' + safeHtml(item.source_type) + ' — ' + safeHtml(item.owner) + '</summary><p>' +
      safeHtml(item.request_text) + '</p><p>Records: ' + safeHtml(item.source_refs.join(', ') || 'not supplied') +
      '</p><pre>' + safeHtml(JSON.stringify(item.source_template, null, 2)) + '</pre></details>';
  });
  if (flow.caller_blockers.length) html += '<p>Caller-declared blockers: ' + safeHtml(flow.caller_blockers.join('; ')) + '</p>';
  var revision = flow.revision;
  if (revision.status !== 'not_provided') {
    html += '<h4>Updated package comparison: ' + safeHtml(revision.status) + '</h4>';
    if (revision.status === 'compared') html += '<p>Newly reviewable document types: ' + safeHtml(revision.newly_reviewable_source_types.join(', ') || 'none') +
      '</p><p>No longer reviewable: ' + safeHtml(revision.no_longer_reviewable_source_types.join(', ') || 'none') +
      '</p><p>Still missing: ' + safeHtml(revision.still_missing_source_types.join(', ') || 'none') + '</p>';
    else html += '<p>Comparison unavailable: ' + safeHtml(revision.comparison_blockers.join(', ')) +
      '. Changed fields: ' + safeHtml(revision.changed_scope_fields.join(', ') || 'none') + '</p>';
    if (revision.removed_caller_blockers.length) html += '<p>Removed blocker statements require human review; removal is not proof of resolution: ' + safeHtml(revision.removed_caller_blockers.join('; ')) + '</p>';
  }
  html += '<p>Templates contain no evidence. Fill blanks from authorized documents, repair the referenced records or add genuinely new documents, and retain unfavorable facts. No messages are sent to suppliers.</p>' +
    '<button type="button" onclick="prepareMineralRevision()">Prepare updated dossier — no check yet</button>' +
    '<p id="mineral-revision-status" role="status"></p>';
  panel.innerHTML = html;
}
function prepareMineralRevision() {
  if (!agendaMineralSubmission) return;
  var editor = document.getElementById('profile-request');
  var current;
  try {
    current = JSON.parse(editor.value);
    if (!current || typeof current !== 'object' || Array.isArray(current)) throw Error('object required');
  } catch (error) {
    var invalid = document.getElementById('mineral-revision-status');
    if (invalid) invalid.textContent = 'Correct Structured request JSON before preparing the updated dossier. Nothing was submitted.';
    return;
  }
  current.previous_submission = JSON.parse(JSON.stringify(agendaMineralSubmission));
  editor.value = JSON.stringify(current, null, 2);
  var intake = document.getElementById('profile-intake');
  if (intake && intake.updateFromJson) intake.updateFromJson();
  var status = document.getElementById('mineral-revision-status');
  if (status) status.textContent = 'Previous submission attached in this page only. Add or correct actual evidence, then explicitly run the next check. A submitted evaluation consumes another attempt; preparation does not.';
}
`;
