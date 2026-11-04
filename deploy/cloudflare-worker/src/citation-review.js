import {reviewAnswer} from './answer-review.js';
// Browser source is kept literal to survive Wrangler's keepNames bundling.
// This prepares one caller-declared claim, never infers support or fetches a URL.
export const CITATION_REVIEW_SCRIPT = String.raw`
var rawLastInput = null;
var rawLastCount = null;
var rawBusy = false;
var outputReviewRecords = {};
var outputRecoveryKind = 'structured_claims';
var rawRecoveryController = null;
function rawReviewInput() {
  var answer=document.getElementById('raw-answer').value, source=document.getElementById('raw-source').value;
  var input={answer:answer,sources:source.trim() ? [{source_id:'s1',text:source}] : []};
  if (document.getElementById('raw-numeric').checked) input.numeric_smoke_check=true;
  return input;
}
async function validateOutputRecoveryInput() {
  if (outputRecoveryKind!=='answer_citations') return agendaNextSteps.validateInput();
  if (!rawRecoveryController) rawRecoveryController=createTrialNextSteps({document:document,
    fetch:function(url,init){return fetch(url,init);},
    headers:function(){return agendaTelemetryHeaders('/v1/validate-input',{'content-type':'application/json'});},
    readInput:function(){return JSON.stringify(rawReviewInput());},tool:'review_answer',
    validationUrl:'/v1/validate-input',paidPrice:''});
  return rawRecoveryController.validateInput();
}
function rememberOutputReview(kind, input, response) {
  outputReviewRecords[kind] = JSON.parse(JSON.stringify({schema_version:'output-review-record.v1',
    review_kind:kind, completed_at:new Date().toISOString(), input:input, response:response,
    scope:'Citation structure and quote occurrence only. Meaning, factual truth and source authenticity are not assessed. Human review is required.'}));
  var button=document.getElementById(kind==='answer_citations' ? 'raw-save' : 'profile-save-review');
  if (button) button.hidden=false;
}
function getOutputReviewRecord(kind) {
  return outputReviewRecords[kind] ? JSON.stringify(outputReviewRecords[kind],null,2) : null;
}
function saveOutputReview(kind) {
  var text=getOutputReviewRecord(kind);
  if (!text) return;
  var url=URL.createObjectURL(new Blob([text],{type:'application/json'}));
  var link=document.createElement('a');link.href=url;link.download='output-review-'+kind+'.json';link.click();
  setTimeout(function(){URL.revokeObjectURL(url);},0);
}
async function runRawReview(event) {
  event.preventDefault();
  if (rawBusy || agendaOutputReviewPending) return;
  outputRecoveryKind='answer_citations';
  var status=document.getElementById('raw-status'), output=document.getElementById('raw-result');
  var button=document.getElementById('raw-run');
  if (agendaTrialBlocked) {
    status.textContent='Free allowance is exhausted. Your input and last completed result are preserved. Check allowance again or view the saved example; no request was sent.';
    setTrialRecovery(true);return;
  }
  var answer=document.getElementById('raw-answer').value, source=document.getElementById('raw-source').value;
  if (!answer.trim() || answer.length > 20000 || source.length > 20000) {
    status.textContent='Enter an answer of up to 20,000 characters and an optional excerpt of up to 20,000 characters. No review requested.'; return;
  }
  if (/^https?:\/\/\S+$/iu.test(source.trim())) {
    status.textContent='A URL alone is not a source excerpt. Paste the actual text or leave the excerpt empty; URLs are not fetched. No review requested.'; return;
  }
  var input=rawReviewInput();
  var serialized=JSON.stringify(input);
  if (serialized===rawLastInput) { status.textContent='Nothing changed since the completed review; no request or attempt used.'; return; }
  rawBusy=true;agendaOutputReviewPending=true;button.disabled=true;status.textContent='Reviewing citation structure…';
  try {
    var id=(window.crypto && crypto.randomUUID) ? crypto.randomUUID() : 'raw-'+Date.now();
    var response=await fetch('/mcp/output-verification',{method:'POST',
      headers:agendaTelemetryHeaders('/mcp/output-verification',{'content-type':'application/json','MCP-Protocol-Version':'2025-11-25'}),
      body:JSON.stringify({jsonrpc:'2.0',id:id,method:'tools/call',params:{name:'review_answer',arguments:input}})});
    var body=await response.json();
    var result=body.result, payload=result && (result.structuredContent || JSON.parse(result.content?.find(function(x){return x.type==='text';})?.text || '{}'));
    var evaluation=payload && payload.evaluation;
    if (response.ok && body.jsonrpc==='2.0' && body.id===id && result?.isError===true &&
        payload?.code==='trial_exhausted' && payload.trial?.attempt_consumed===false &&
        ['network_allowance_exhausted','daily_capacity_exhausted'].includes(payload.trial?.limit_reason)) {
      agendaTrialBlocked=true;
      document.getElementById('profile-run').disabled=true;
      setTrialRecovery(true);agendaNextSteps.showRecovery(payload.trial.limit_reason,payload.trial.reset_at);
      status.textContent='Free allowance is exhausted. Your input and last completed result are preserved. Check allowance again or view the saved example; no automatic retry.';
      return;
    }
    if (!response.ok || body.jsonrpc!=='2.0' || body.id!==id || body.error || !result || result.isError || !evaluation || evaluation.schema_version!=='answer-citation-review.v1' ||
        !['revise','human_review'].includes(evaluation.route) || !Array.isArray(evaluation.findings) ||
        evaluation.human_review_required!==true || evaluation.authorization_granted!==false || evaluation.factuality!=='not_assessed' ||
        evaluation.semantic_support!=='not_assessed' || typeof evaluation.next_action!=='string' ||
        (evaluation.route==='revise')!==(evaluation.findings.length>0) ||
        evaluation.findings.some(function(f){return !Number.isInteger(f?.line) || typeof f.next_action!=='string' || typeof f.code!=='string';}) ||
        payload.trial?.attempt_consumed!==true) {
      status.textContent='Review did not complete ('+(payload?.code || body.error?.message || response.status)+'). Previous result is unchanged. No automatic retry.'; return;
    }
    var delta=rawLastCount===null ? '' : 'Previous: '+rawLastCount+' issues; current: '+evaluation.findings.length+'. Review changes to the answer and source.\n\n';
    output.hidden=false;
    output.textContent=delta+(evaluation.route==='revise' ? 'REVISE' : 'HUMAN REVIEW')+' — no permission to relay or act.\n'+
      'Next: '+(evaluation.findings.length ? 'Line '+evaluation.findings[0].line+': '+evaluation.findings[0].next_action : evaluation.next_action)+'\n\n'+
      (evaluation.findings.length ? evaluation.findings.map(function(f){return 'Line '+f.line+': '+f.code+(f.source_id ? ' ['+f.source_id+']' : '');}).join('\n') : 'No citation or quote structure issues found.');
    status.textContent='Completed: '+evaluation.findings.length+' citation/quote issues. One shared trial attempt used. Factuality and semantic support were not assessed.';
    rawLastInput=serialized;rawLastCount=evaluation.findings.length;
    rememberOutputReview('answer_citations',input,payload);
  } catch(error) { status.textContent='The result could not be received. An attempt may have been consumed; previous result is unchanged. No automatic retry.'; }
  finally {rawBusy=false;agendaOutputReviewPending=false;button.disabled=false;}
}
function showCitationDemo(which) {
  document.getElementById('citation-demo-before').hidden=which!=='before';
  document.getElementById('citation-demo-after').hidden=which!=='after';
}
async function runCitationReview(event) {
  event.preventDefault();
  var status = document.getElementById('citation-status');
  var button = document.getElementById('citation-run');
  if (button.disabled || (document.getElementById('profile-run').disabled && !agendaTrialBlocked)) {
    status.textContent = 'A check is already running. Wait for its response.';
    return;
  }
  outputRecoveryKind='structured_claims';
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
  const before=reviewAnswer({answer:'The report says "five warehouses" [s1]\nAnother claim [s2]',sources:[{source_id:'s1',text:'The report lists three warehouses.'}]});
  const after=reviewAnswer({answer:'The report says "three warehouses" [s1]\nAnother claim [s2]',sources:[{source_id:'s1',text:'The report lists three warehouses.'},{source_id:'s2',text:'Another claim.'}]});
  return `<section id="one-claim-review" aria-label="Review one claim">
    <h2>Review an AI answer before handoff</h2>
    <p>Paste the answer. Add the actual excerpt for [s1] if available. Other IDs stay unresolved; URLs are not fetched. This checks structure only, not truth or semantic support.</p>
    <p><small>For a quoted excerpt, put the citation directly after its closing quote: <code>&quot;exact source words&quot; [s1]</code>. Paste the matching source text below.</small></p>
    <form onsubmit="runRawReview(event)"><label for="raw-answer">AI answer</label><textarea id="raw-answer" rows="5" maxlength="20000" required style="width:100%;font:inherit;padding:8px"></textarea>
      <label for="raw-source">Source text for [s1] (optional)</label><textarea id="raw-source" rows="4" maxlength="20000" style="width:100%;font:inherit;padding:8px"></textarea>
      <p><label><input id="raw-numeric" type="checkbox"> Flag number tokens missing from cited excerpts (optional)</label><br><small>Literal comparison only; formatting may differ. A match does not confirm meaning, units or truth. Unresolved citations are not checked for numbers.</small></p>
      <button id="raw-run" type="submit" class="primary-action primary-action-main">Review answer · uses 1 attempt</button>
      <p id="raw-status" role="status"></p><pre id="raw-result" hidden></pre>
      <button id="raw-save" type="button" hidden onclick="saveOutputReview('answer_citations')">Save last completed answer review locally</button>
      <p><small>The download contains the checked answer, supplied source text and result. Later edits are not included until checked. Nothing is uploaded by saving; keep the file private if the material is private.</small></p>
    </form>
    <p>Each explicit review uses one of ${attempts} shared network attempts. Corrections need another attempt; unchanged completed input is not resubmitted. Do not submit confidential material.</p>
    <section aria-label="Synthetic citation demonstration"><h3>Try the synthetic before / after</h3><p>Saved example, no attempt used. It does not check your input.</p>
      <button type="button" onclick="showCitationDemo('before')">Show before</button><button type="button" onclick="showCitationDemo('after')">Show after</button>
      <p id="citation-demo-before" hidden>Before: ${before.findings.length} citation/quote issues — revise. Fictional answer quotes five warehouses; source says three, and [s2] is missing.</p>
      <p id="citation-demo-after" hidden>After: ${after.findings.length} citation/quote issues — human review. Fictional quote and source references corrected. No truth verification or permission to act.</p>
    </section>
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
