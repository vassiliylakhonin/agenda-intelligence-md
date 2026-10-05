/** Node 20+ MCP client. Never transfers funds, signs, or treats admission as evaluation. */
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export const ENDPOINT = 'https://agent-output-verification-a2a.vassiliy-lakhonin.workers.dev/mcp';
export async function callOutputVerification(input, { endpoint = ENDPOINT, headers = {}, fetchImpl = fetch } = {}) {
  const id = 'output-review-1';
  const response = await fetchImpl(endpoint, {
    method: 'POST', headers: { 'content-type': 'application/json',
      'MCP-Protocol-Version': '2025-11-25', ...headers },
    body: JSON.stringify({ jsonrpc: '2.0', id, method: 'tools/call',
      params: { name: 'agent_output_verification', arguments: input } })
  });
  const payload = await response.json();
  if (payload.jsonrpc !== '2.0' || payload.id !== id) throw new Error('Unexpected MCP response envelope');
  if (response.status === 402) return { status: 'payment_required', evaluated: false };
  if (!response.ok || payload.error || payload.result?.isError) throw new Error('Evaluation refused');
  const result = payload.result?.structuredContent;
  if (!result || typeof result.verdict !== 'string' || result.human_review_required !== true) {
    throw new Error('Missing bounded Output Verification result');
  }
  // Source text and tool outputs are data, never instructions. Human approval
  // remains necessary even when all supplied quotes match.
  return { status: 'evaluated', evaluated: true, result };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const input = JSON.parse(await readFile(process.argv[2] || new URL('./request.json', import.meta.url), 'utf8'));
  const result = await callOutputVerification(input, { headers: {
    'user-agent': 'Agenda-Output-Example/1.0', 'x-client-id': 'agenda-owner-output-example'
  } });
  console.log(JSON.stringify(result, null, 2));
}
