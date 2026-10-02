import { BASE_USDC_CONTRACT, BASE_USDC_WALLET } from './profiles.js';

// Browser checkout, entered only after an explicit payment confirmation.
// The original body and signature survive a failed HTTP response in this page.
export const PAYMENT_CLIENT_SCRIPT = `
var agendaPendingPayment = null;
var agendaPaymentBusy = false;
function agendaShowRecovery(record) {
  if (typeof document === 'undefined' || !document.body || !document.body.appendChild) return;
  var button = document.getElementById('agenda-payment-recovery');
  if (!button) {
    button = document.createElement('button');
    button.id = 'agenda-payment-recovery';
    button.type = 'button';
    button.style.cssText = 'position:fixed;bottom:16px;right:16px;padding:12px;z-index:1000;background:#172033;color:white;border-radius:8px';
    document.body.appendChild(button);
  }
  button.textContent = 'Save private payment recovery record';
  button.onclick = function() {
    var link = document.createElement('a');
    var blobUrl = URL.createObjectURL(new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' }));
    link.href = blobUrl;
    link.download = 'agenda-payment-recovery.json';
    link.click();
    URL.revokeObjectURL(blobUrl);
  };
}
async function agendaPaidFetch(url, options, expectedAmount) {
  if (window.agendaExampleTraceId && new URL(url, window.location.href).origin === window.location.origin) {
    options = Object.assign({}, options, {headers:Object.assign({}, options.headers,
      {'x-example-trace-id':window.agendaExampleTraceId})});
  }
  if (agendaPaymentBusy) throw new Error('A payment request is already running.');
  agendaPaymentBusy = true;
  try {
    var pending = agendaPendingPayment;
    if (pending && pending.url !== url) throw new Error('Recover the pending paid request before starting another.');
    var response;
    if (!pending) {
      response = await fetch(url, options);
      if (response.status !== 402) return response;
      var payment = await response.clone().json();
      var amount = Number(payment.x402 && payment.x402.amount_usdc || payment.required_usdc);
      if (amount !== expectedAmount) throw new Error('Unexpected price; inspect the payment response before proceeding.');
      if (!window.ethereum) throw new Error('An EVM wallet is required for paid evaluation.');
      if (!window.confirm('Pay ' + amount + ' USDC on Base for this one evaluation? Save the transaction hash and original signature for recovery.')) return response;
      var accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      if (!accounts || !accounts[0]) throw new Error('No account selected.');
      await window.ethereum.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: '0x2105' }] });
      if (Number(await window.ethereum.request({ method: 'eth_chainId' })) !== 8453) throw new Error('Base network is required.');
      var tx = await window.ethereum.request({ method: 'eth_sendTransaction', params: [{ from: accounts[0], to: '${BASE_USDC_CONTRACT}',
        data: '0xa9059cbb' + '${BASE_USDC_WALLET}'.slice(2).toLowerCase().padStart(64, '0') + BigInt(Math.round(amount * 1e6)).toString(16).padStart(64, '0') }] });
      pending = { url: url, options: { method: options.method, headers: Object.assign({}, options.headers), body: options.body }, tx: tx, payer: accounts[0], signature: null };
      agendaPendingPayment = pending;
      agendaShowRecovery(pending);
    }
    var signedOptions = { method: pending.options.method, body: pending.options.body,
      headers: Object.assign({}, pending.options.headers, { 'x-payment-tx': pending.tx }) };
    if (pending.signature) signedOptions.headers['x-payment-signature'] = pending.signature;
    response = await fetch(pending.url, signedOptions);
    if (response.status === 401 && !pending.signature) {
      var challenge = await response.clone().json();
      if (!challenge.challenge_message) throw new Error('No signing challenge returned.');
      var hex = '0x' + Array.from(new TextEncoder().encode(challenge.challenge_message)).map(function(b) { return b.toString(16).padStart(2, '0'); }).join('');
      pending.signature = await window.ethereum.request({ method: 'personal_sign', params: [hex, pending.payer] });
      agendaShowRecovery(pending);
      signedOptions.headers['x-payment-signature'] = pending.signature;
      response = await fetch(pending.url, signedOptions);
    }
    var result = await response.clone().json();
    if (response.ok && !result.error && !(result.result && result.result.isError)) agendaPendingPayment = null;
    else throw new Error('Paid request incomplete (' + response.status + '). Retry reuses ' + pending.tx + ' and its original input. Do not pay again; contact support if recovery fails.');
    return response;
  } finally { agendaPaymentBusy = false; }
}
`;
