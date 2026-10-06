/** Node 20+ MCP client. No wallet, signing, transfer or automatic payment retry. */
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';

export const ENDPOINT = 'https://agent-output-verification-a2a.vassiliy-lakhonin.workers.dev/mcp';
const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

/** Keep this call in memory for challenge, signed execution and recovery. */
export function createOutputVerificationCall(input, {
  endpoint = ENDPOINT, headers = {}, fetchImpl = fetch, requestId = 'output-review-1'
} = {}) {
  const body = JSON.stringify({ jsonrpc: '2.0', id: requestId, method: 'tools/call',
    params: { name: 'agent_output_verification', arguments: input } });
  const fixedHeaders = Object.fromEntries(new Headers(headers));
  fixedHeaders['content-type'] = 'application/json';
  fixedHeaders['mcp-protocol-version'] = '2025-11-25';
  let trace = UUID.test(fixedHeaders['x-payment-trace-id'] || '')
    ? fixedHeaders['x-payment-trace-id'].toLowerCase() : randomUUID();
  let transactionHash = fixedHeaders['x-payment-tx'] || null;
  let signature = fixedHeaders['x-payment-signature'] || null;
  let busy = false;

  async function send() {
    if (busy) throw new Error('This call is already running');
    busy = true;
    try {
      const requestHeaders = { ...fixedHeaders, 'x-payment-trace-id': trace };
      if (transactionHash) requestHeaders['x-payment-tx'] = transactionHash;
      if (signature) requestHeaders['x-payment-signature'] = signature;
      const response = await fetchImpl(endpoint, { method: 'POST', headers: requestHeaders, body });
      const returnedTrace = response.headers.get('x-payment-trace-id');
      if (UUID.test(returnedTrace || '')) trace = returnedTrace.toLowerCase();
      const payload = await response.json();
      if (payload.jsonrpc !== '2.0' || payload.id !== requestId) throw new Error('Unexpected MCP response envelope');
      const details = payload.error?.data || payload;
      if (response.status === 402) {
        const amount = details.x402?.amount_usdc ?? details.required_usdc;
        return { status: 'payment_required', evaluated: false, paymentTraceId: trace,
          payment: { required_usdc: typeof amount === 'number' ? amount : null, x402: details.x402 || null },
          nextAction: transactionHash ? 'inspect_payment_refusal_do_not_transfer_again' : 'inspect_price_and_configure_payment' };
      }
      if (response.status === 401 && transactionHash && typeof details.challenge_message === 'string') {
        return { status: 'signature_required', evaluated: false, paymentTraceId: trace,
          challengeMessage: details.challenge_message, nextAction: 'funding_wallet_signs_exact_challenge' };
      }
      if (!response.ok || payload.error || payload.result?.isError) throw new Error(`Evaluation refused (HTTP ${response.status})`);
      const result = payload.result?.structuredContent;
      if (!result || typeof result.verdict !== 'string' || result.human_review_required !== true) {
        throw new Error('Missing bounded Output Verification result');
      }
      return { status: 'evaluated', evaluated: true, result };
    } finally { busy = false; }
  }

  return Object.freeze({
    evaluate: send,
    async retryWithPayment(proof = {}) {
      if (busy) throw new Error('This call is already running');
      const tx = proof.transactionHash;
      if (tx !== undefined && (typeof tx !== 'string' || !/^0x[0-9a-f]{64}$/i.test(tx))) throw new Error('Invalid transaction hash');
      if (transactionHash && tx !== undefined && transactionHash.toLowerCase() !== tx.toLowerCase()) {
        throw new Error('Recover the original payment; do not supply a second transfer');
      }
      if (proof.signature !== undefined && (typeof proof.signature !== 'string' || !/^0x[0-9a-f]{130}$/i.test(proof.signature))) {
        throw new Error('Invalid EIP-191 signature');
      }
      if (signature && proof.signature !== undefined && signature.toLowerCase() !== proof.signature.toLowerCase()) {
        throw new Error('Recover with the original payment signature');
      }
      if (!transactionHash && tx === undefined) throw new Error('Supply an existing payment transaction hash');
      transactionHash = transactionHash || tx.toLowerCase();
      signature = signature || proof.signature || null;
      return send();
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
