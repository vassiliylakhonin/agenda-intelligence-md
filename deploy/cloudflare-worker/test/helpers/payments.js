import { readFileSync } from 'node:fs';
// Independent secp256k1 EIP-191 vectors generated with @noble/curves 2.4.0.
// Pure fixture lookup keeps tests offline and prevents production key access.
const signatures = JSON.parse(readFileSync(new URL('../fixtures/payment-signatures.json', import.meta.url)));
import { BASE_USDC_CONTRACT, BASE_USDC_WALLET, ERC20_TRANSFER_TOPIC } from '../../src/profiles.js';
import { normalizeAddressForTopic } from '../../src/settlement.js';
import { paidRequestChallenge, paidRequestHash } from '../../src/paid-execution.js';

export const payer = '0x19e7e376e7c213b7e7e7e46cc70a5dd086daff2a';
// Public synthetic key, never used for a wallet/network transfer.
export function sign(message, keyDigit = '1') {
  const signature = signatures[keyDigit + ':' + message];
  if (!signature) throw new Error('Missing independent payment signature fixture: ' + message);
  return signature;
}

export async function signedRequest(url, body, tx, headers = {}, keyDigit = '1') {
  const request = new Request(url, { method: 'POST', headers: { 'content-type': 'application/json', 'x-payment-tx': tx, ...headers }, body: JSON.stringify(body) });
  request.headers.set('x-payment-signature', sign(paidRequestChallenge(tx, await paidRequestHash(request, body)), keyDigit));
  return request;
}
export function rpcReceipt(amount = 0.05) {
  return { status: '0x1', blockNumber: '0x123', logs: [{ address: BASE_USDC_CONTRACT,
    topics: [ERC20_TRANSFER_TOPIC, normalizeAddressForTopic(payer), normalizeAddressForTopic(BASE_USDC_WALLET)],
    data: '0x' + BigInt(Math.round(amount * 1e6)).toString(16) }] };
}
export function mockRpc(amount = 0.05) {
  return async (_url, options) => Response.json({ jsonrpc: '2.0', id: 1,
    result: JSON.parse(options.body).method === 'eth_getBlockByNumber'
      ? { timestamp: '0x' + Math.floor(Date.now() / 1000).toString(16) } : rpcReceipt(amount) });
}
