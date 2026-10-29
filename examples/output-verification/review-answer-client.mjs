// A small, explicitly invoked trial client. No payment, automatic retry or relay.
// Errors and incomplete responses throw; callers must stop their workflow.
export async function reviewAnswerBeforeRelay(answer, sources = [], options = {}) {
  const {fetchImpl = fetch, endpoint = 'https://output-verification.agendamcp.dpdns.org/mcp/output-verification', headers = {}, numericSmokeCheck = false} = options;
  const url = new URL(endpoint);
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) throw new Error('Use an HTTPS MCP endpoint without credentials or fragment.');
  if (typeof answer !== 'string' || !answer.trim() || !Array.isArray(sources)) throw new Error('Provide an answer and an array of source excerpts.');
  if (typeof numericSmokeCheck !== 'boolean') throw new Error('numericSmokeCheck must be a boolean.');
  const id = globalThis.crypto.randomUUID();
  const response = await fetchImpl(url.href, {method:'POST', redirect:'error',
    headers:{...headers,'content-type':'application/json','MCP-Protocol-Version':'2025-11-25'},
    body:JSON.stringify({jsonrpc:'2.0',id,method:'tools/call',params:{name:'review_answer',arguments:{answer,sources,...(numericSmokeCheck ? {numeric_smoke_check:true} : {})}}})});
  let body;
  try {body=await response.json();} catch {throw new Error('Unreadable review response; stop and inspect the attempt before retrying.');}
  const result=body?.result;
  if (!response.ok || body?.jsonrpc !== '2.0' || body?.id !== id || body?.error || !result || result.isError || !result.structuredContent) {
    throw new Error('Review unavailable or refused; stop and inspect admission and attempt status before retrying.');
  }
  const {evaluation,trial}=result.structuredContent;
  if (evaluation?.schema_version !== 'answer-citation-review.v1' || !['revise','human_review'].includes(evaluation.route) ||
      !Array.isArray(evaluation.findings) || evaluation.human_review_required !== true || evaluation.authorization_granted !== false ||
      evaluation.factuality !== 'not_assessed' || evaluation.semantic_support !== 'not_assessed' || typeof evaluation.next_action !== 'string' ||
      (evaluation.route === 'revise') !== (evaluation.findings.length > 0) ||
      evaluation.findings.some(f=>!Number.isInteger(f?.line) || typeof f.next_action !== 'string' || typeof f.code !== 'string') ||
      trial?.attempt_consumed !== true) throw new Error('Incomplete review response; stop for investigation.');
  const first=evaluation.findings[0];
  return {evaluation,trial,relay_allowed:false,summary:{verdict:evaluation.route === 'revise' ? 'REVISE' : 'HUMAN_REVIEW',
    next_one_thing:first ? `Line ${first.line}: ${first.next_action}` : evaluation.next_action}};
}
