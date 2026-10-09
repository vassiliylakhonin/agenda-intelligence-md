/** Node 20+ retained MCP call. No automatic wallet access, signing or funding. */
import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

const UUID = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

/** Admission diagnostics only; a refusal is never an evaluated result. */
export class HostedMcpError extends Error {
  constructor(message, {status, paymentTraceId, paymentAttemptId, details = null} = {}) {
    super(message);
    this.name = 'HostedMcpError';
    this.status = status;
    this.paymentTraceId = paymentTraceId;
    this.paymentAttemptId = paymentAttemptId;
    this.details = details;
    this.requestHint = details?.request_hint || null;
  }
}

/** Keep this call in memory for challenge, signed execution and recovery. */
export function createHostedMcpCall(tool, input, {
  endpoint, headers = {}, fetchImpl = fetch, requestId = randomUUID(), mapResult = value => value
} = {}) {
  if (!endpoint || typeof tool !== 'string' || !tool.trim()) throw new Error('Supply the serving MCP endpoint and published tool name');
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Tool input must be a JSON object matching the published inputSchema');
  const body = JSON.stringify({ jsonrpc: '2.0', id: requestId, method: 'tools/call',
    params: { name: tool, arguments: input } });
  const serializedInput = JSON.parse(body).params.arguments;
  if (!serializedInput || typeof serializedInput !== 'object' || Array.isArray(serializedInput)) throw new Error('Tool input must serialize to a JSON object');
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
      const fail = (message, details = null) => new HostedMcpError(message, {
        status: response.status, paymentTraceId: trace,
        paymentAttemptId: response.headers.get('x-payment-attempt-id'), details
      });
      let payload;
      try { payload = await response.json(); }
      catch { throw fail(`Unreadable MCP response (HTTP ${response.status}); retain this call for recovery`); }
      if (!payload || typeof payload !== 'object' || payload.jsonrpc !== '2.0' || payload.id !== requestId) throw fail('Unexpected MCP response envelope');
      const admission = payload.result?.isError === true ? payload.result._meta?.['com.agenda/admission'] : null;
      const admissionStatus = admission?.evaluated === false && [401,402].includes(admission.admission_status)
        ? admission.admission_status : response.status;
      const details = admission?.details || payload.error?.data || payload;
      if (admissionStatus === 402) {
        const amount = details.x402?.amount_usdc ?? details.required_usdc;
        return { status: 'payment_required', evaluated: false, paymentTraceId: trace,
          payment: { required_usdc: typeof amount === 'number' ? amount : null, x402: details.x402 || null },
          nextAction: transactionHash ? 'inspect_payment_refusal_do_not_transfer_again' : 'inspect_price_and_configure_payment' };
      }
      if (admissionStatus === 401 && transactionHash && typeof details.challenge_message === 'string') {
        return { status: 'signature_required', evaluated: false, paymentTraceId: trace,
          challengeMessage: details.challenge_message, nextAction: 'funding_wallet_signs_exact_challenge' };
      }
      if (!response.ok || payload.error || payload.result?.isError) throw fail(`Evaluation refused (HTTP ${response.status})`, details);
      const result = payload.result?.structuredContent;
      if (!result || typeof result !== 'object' || Array.isArray(result)) throw fail('Missing structured MCP result');
      return { status: 'evaluated', evaluated: true, result: mapResult(result) };
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


if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [endpoint, tool, requestFile] = process.argv.slice(2);
  if (!endpoint || !tool || !requestFile) throw new Error('Usage: node client.mjs MCP_URL TOOL REQUEST_JSON');
  const input = JSON.parse(await readFile(requestFile, 'utf8'));
  const call = createHostedMcpCall(tool, input, { endpoint, headers: {
    'user-agent': 'Agenda-Hosted-Example/1.0', 'x-client-id': 'agenda-owner-hosted-example'
  } });
  console.log(JSON.stringify(await call.evaluate(), null, 2));
}
