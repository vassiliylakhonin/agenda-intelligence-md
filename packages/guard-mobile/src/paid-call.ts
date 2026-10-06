/** Retain exact REST request and existing proof. Never fund, sign or auto-retry. */
export interface PaymentProof { transactionHash?: string; signature?: string }
export interface RetainedPaidCall<T> {
  evaluate(): Promise<T>;
  retryWithPayment(proof?: PaymentProof): Promise<T>;
  hasPayment(): boolean;
}
export class PaymentAdmissionError extends Error {
  readonly name = "PaymentAdmissionError";
  constructor(readonly status: number, readonly details: Record<string, unknown>, readonly paymentTraceId: string | null) {
    super(`Paid evaluation refused (HTTP ${status}); inspect the existing payment before retrying`);
  }
}
export class NetworkRequestError extends Error {
  readonly name = "NetworkRequestError";
}
export function createRetainedPaidCall<T>(endpoint: string, payload: unknown,
  fetchImpl: typeof fetch, timeoutMs: number, decode: (value: any) => T,
  initialTransactionHash?: string): RetainedPaidCall<T> {
  const body = JSON.stringify(payload);
  let tx: string | null = null, signature: string | null = null, busy = false;
  let trace: string | null = globalThis.crypto?.randomUUID?.() ?? null;
  const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
  function retain(proof: PaymentProof) {
    if (proof.transactionHash !== undefined) {
      if (!/^0x[0-9a-f]{64}$/i.test(proof.transactionHash)) throw new Error("Invalid transaction hash");
      if (tx && tx !== proof.transactionHash.toLowerCase()) throw new Error("Recover the original payment; do not supply a second transfer");
    }
    if (proof.signature !== undefined) {
      if (!/^0x[0-9a-f]{130}$/i.test(proof.signature)) throw new Error("Invalid EIP-191 signature");
      if (signature && signature !== proof.signature.toLowerCase()) throw new Error("Recover with the original payment signature");
    }
    // Validate both fields before mutating retained state.
    tx = tx || proof.transactionHash?.toLowerCase() || null;
    signature = signature || proof.signature?.toLowerCase() || null;
  }
  if (initialTransactionHash) retain({transactionHash:initialTransactionHash});
  async function send() {
    if (busy) throw new Error("This call is already running");
    busy = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const headers: Record<string, string> = {"content-type":"application/json", "user-agent":"AgendaGuardMobile/1.2.3"};
      if (trace) headers["x-payment-trace-id"] = trace;
      if (tx) headers["x-payment-tx"] = tx;
      if (signature) headers["x-payment-signature"] = signature;
      let response: Response;
      try { response = await fetchImpl(endpoint, {method:"POST", headers, body, signal:controller.signal}); }
      catch (error) { throw new NetworkRequestError(error instanceof Error ? error.message : "Network request failed"); }
      const returned = response.headers.get("x-payment-trace-id");
      if (returned && uuid.test(returned)) trace = returned.toLowerCase();
      const data = await response.json();
      if (!response.ok) throw new PaymentAdmissionError(response.status, data.error?.data || data, trace);
      if (data.error || data.isError) throw new Error("Evaluation returned an error");
      return decode(data);
    } finally { clearTimeout(timeout); busy = false; }
  }
  return Object.freeze({evaluate:send, hasPayment:()=>Boolean(tx), retryWithPayment:async(proof:PaymentProof={})=>{
    if (busy) throw new Error("This call is already running");
    retain(proof);
    if (!tx) throw new Error("Supply an existing payment transaction hash");
    return send();
  }});
}
