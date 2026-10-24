import {BASE_USDC_WALLET,BASE_USDC_CONTRACT} from './profiles.js';
import {x402Enabled} from './x402-v2.js';

export const X402_DISCOVERY_URI='https://www.x402.org/';

// Recipient identity only: a directory must not infer a quote or a paid call
// from these fields. The exact operation's challenge remains authoritative.
export function settlementDiscovery(origin) {
  return {payTo:BASE_USDC_WALLET,network:'eip155:8453',asset:BASE_USDC_CONTRACT,
    currency:'USDC',manifest:origin+'/.well-known/x402',
    explorer_url:'https://basescan.org/address/'+BASE_USDC_WALLET};
}

export function x402DiscoveryExtension(origin,env) {
  if(!x402Enabled(env)) return null;
  return {uri:X402_DISCOVERY_URI,required:false,
    description:'Optional x402 payment discovery. Paid operations use HTTP payment headers or MCP x402/payment metadata. Free routing and trials retain their own terms. Obtain the exact operation’s current challenge before authorizing payment. This does not declare the A2A task-state payment extension.',
    params:{...settlementDiscovery(origin),x402Version:2,scheme:'exact'}};
}
