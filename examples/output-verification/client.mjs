/** Node 20+ MCP client. No wallet, signing, transfer or automatic payment retry. */
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createHostedMcpCall } from '../hosted-mcp/client.mjs';

export const ENDPOINT = 'https://agent-output-verification-a2a.vassiliy-lakhonin.workers.dev/mcp';
/** Output-specific result guard over the fleet's retained MCP request helper. */
export function createOutputVerificationCall(input, options = {}) {
  return createHostedMcpCall('agent_output_verification', input, {
    endpoint: ENDPOINT, requestId: 'output-review-1', ...options,
    mapResult(result) {
      if (typeof result.verdict !== 'string' || result.human_review_required !== true) {
        throw new Error('Missing bounded Output Verification result');
      }
      return result;
    }
  });
}

/** One-shot admission/evaluation; use a retained call for payment recovery. */
export async function callOutputVerification(input, options = {}) {
  return createOutputVerificationCall(input, options).evaluate();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const input = JSON.parse(await readFile(process.argv[2] || new URL('./request.json', import.meta.url), 'utf8'));
  const result = await callOutputVerification(input, { headers: {
    'user-agent': 'Agenda-Output-Example/1.0', 'x-client-id': 'agenda-owner-output-example'
  } });
  console.log(JSON.stringify(result, null, 2));
}
