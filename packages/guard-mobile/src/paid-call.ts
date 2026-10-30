/** Retain exact REST requests and existing wallet proofs. Never fund, sign or auto-retry. */
export interface X402PaymentRequired {
  x402Version: 2;
  resource: { url: string; [key: string]: unknown };
  accepts: Record<string, unknown>[];
  [key: string]: unknown;
}
export interface X402PaymentPayload {
  x402Version: 2;
  accepted: Record<string, unknown>;
  payload: { signature: string; authorization: Record<string, unknown> };
  resource?: { url: string; [key: string]: unknown };
}
export interface PaymentProof {
  transactionHash?: string;
  signature?: string;
  /** Already signed x402 v2 payload or its base64 PAYMENT-SIGNATURE header. */
  paymentSignature?: X402PaymentPayload | string;
}
export interface RetainedPaidCall<T> {
  evaluate(): Promise<T>;
  retryWithPayment(proof?: PaymentProof): Promise<T>;
  hasPayment(): boolean;
  /** Unverified server metadata, never transaction or settlement authorization. */
  getPaymentResponse(): Record<string, unknown> | null;
}
export class PaymentAdmissionError extends Error {
  readonly name = "PaymentAdmissionError";
  constructor(readonly status: number, readonly details: Record<string, unknown>, readonly paymentTraceId: string | null,
    readonly paymentRequired: X402PaymentRequired | null = null) {
    super(`Paid evaluation refused (HTTP ${status}); inspect the existing payment before retrying`);
  }
}
export class NetworkRequestError extends Error { readonly name = "NetworkRequestError"; }
function object(value: unknown): value is Record<string, any> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
function decodeHeader(value: string): Record<string, any> {
  if (value.length > 16384 || !/^[A-Za-z0-9+/]+={0,2}$/.test(value)) throw new Error("Invalid x402 header");
  const result: unknown = JSON.parse(new TextDecoder("utf-8", {fatal:true}).decode(Uint8Array.from(atob(value), c=>c.charCodeAt(0))));
  if (!object(result)) throw new Error("Invalid x402 header object");
  return result;
}
function encodePayload(value: X402PaymentPayload): string {
  const json = JSON.stringify(value);
  if (json.length > 12288) throw new Error("x402 payload too large");
  const bytes = new TextEncoder().encode(json);
  if (bytes.length > 12288) throw new Error("x402 payload too large");
  return btoa(String.fromCharCode(...bytes));
}
function canonical(value: any): string {
  if (Array.isArray(value)) return '['+value.map(canonical).join(',')+']';
  if (object(value)) return '{'+Object.keys(value).sort().map(k=>JSON.stringify(k)+':'+canonical(value[k])).join(',')+'}';
  return JSON.stringify(value);
}
export function createRetainedPaidCall<T>(endpoint: string, payload: unknown,
  fetchImpl: typeof fetch, timeoutMs: number, decode: (value: any) => T,
  initialTransactionHash?: string): RetainedPaidCall<T> {
  const body = JSON.stringify(payload);
  let tx: string | null = null, signature: string | null = null, standard: string | null = null, standardIdentity: string | null = null;
  let required: X402PaymentRequired | null = null, paymentResponse: Record<string, unknown> | null = null, busy = false;
  let trace: string | null = globalThis.crypto?.randomUUID?.() ?? null;
  const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
  function retain(proof: PaymentProof) {
    const hasLegacy = proof.transactionHash !== undefined || proof.signature !== undefined;
    if ((proof.paymentSignature !== undefined && (hasLegacy || tx || signature)) || (standard && hasLegacy)) {
      throw new Error("Do not mix legacy and x402 v2 payment proofs");
    }
    let encoded: string | null = null, identity: string | null = null;
    if (proof.paymentSignature !== undefined) {
      encoded = typeof proof.paymentSignature === "string" ? proof.paymentSignature :
        encodePayload(proof.paymentSignature);
      const value = decodeHeader(encoded);
      identity = canonical(value);
      if (standardIdentity && identity !== standardIdentity) throw new Error("Recover with the original x402 payment proof; do not sign another transfer");
      if (!standard) {
        if (!required || required.resource.url !== endpoint || value.x402Version !== 2 ||
          !object(value.accepted) || value.accepted.scheme !== "exact" ||
          !required.accepts.some(r=>canonical(r)===canonical(value.accepted)) ||
          (value.resource !== undefined && (!object(value.resource) || value.resource.url !== endpoint)) ||
          !object(value.payload) || !/^0x[0-9a-f]{130}$/i.test(value.payload.signature || "") ||
          !object(value.payload.authorization)) throw new Error("x402 proof does not match the advertised requirements and resource");
      }
    }
    if (proof.transactionHash !== undefined && (!/^0x[0-9a-f]{64}$/i.test(proof.transactionHash) ||
      (tx && tx !== proof.transactionHash.toLowerCase()))) throw new Error("Invalid transaction hash or second transfer; recover the original payment");
    if (proof.signature !== undefined && (!/^0x[0-9a-f]{130}$/i.test(proof.signature) ||
      (signature && signature !== proof.signature.toLowerCase()))) throw new Error("Invalid EIP-191 signature; recover with the original payment signature");
    if (proof.signature !== undefined && !tx && proof.transactionHash === undefined) throw new Error("Supply the existing transaction hash before its signature");
    // Validate all fields before changing the retained proof.
    tx = tx || proof.transactionHash?.toLowerCase() || null;
    signature = signature || proof.signature?.toLowerCase() || null;
    standard = standard || encoded;
    standardIdentity = standardIdentity || identity;
  }
  if (initialTransactionHash) retain({transactionHash:initialTransactionHash});
  async function send() {
    if (busy) throw new Error("This call is already running");
    busy = true;
    const controller = new AbortController();
    const timeout = setTimeout(()=>controller.abort(), timeoutMs);
    try {
      const headers: Record<string,string> = {"content-type":"application/json", "user-agent":"AgendaGuardMobile/1.4.0"};
      if (trace) headers["x-payment-trace-id"] = trace;
      if (tx) headers["x-payment-tx"] = tx;
      if (signature) headers["x-payment-signature"] = signature;
      if (standard) headers["PAYMENT-SIGNATURE"] = standard;
      let response: Response;
      try { response = await fetchImpl(endpoint, {method:"POST", headers, body, signal:controller.signal, redirect:"error"}); }
      catch (error) { throw new NetworkRequestError(error instanceof Error ? error.message : "Network request failed"); }
      const returned = response.headers.get("x-payment-trace-id");
      // Once a proof is attached, retries keep its original trace as well as body and URL.
      if (!tx && !standard && returned && uuid.test(returned)) trace = returned.toLowerCase();
      let requirement: X402PaymentRequired | null = null;
      try {
        const h = response.headers.get("PAYMENT-REQUIRED");
        if (h) {
          const value = decodeHeader(h);
          if (value.x402Version !== 2 || !object(value.resource) || value.resource.url !== endpoint ||
            !Array.isArray(value.accepts) || value.accepts.length === 0 || value.accepts.length > 16 ||
            !value.accepts.every(object)) throw new Error("Invalid x402 requirements");
          requirement = value as X402PaymentRequired;
          if (!standard && !tx) required = structuredClone(requirement);
        }
        const receipt = response.headers.get("PAYMENT-RESPONSE");
        if (receipt) paymentResponse = decodeHeader(receipt);
      } catch {
        if (!response.ok) throw new PaymentAdmissionError(response.status, {error:"invalid_x402_header"}, trace);
        throw new Error("Invalid x402 response header; retain the original proof for recovery");
      }
      let text: string;
      try { text = await response.text(); }
      catch (error) {
        if (!response.ok) throw new PaymentAdmissionError(response.status, {error:"unreadable_http_response",http_status:response.status},trace,requirement);
        throw new NetworkRequestError(error instanceof Error ? error.message : "Response body could not be read");
      }
      let data: any;
      try { data=JSON.parse(text); } catch { /* Preserve HTTP refusal, including header-only x402 requirements. */ }
      if (!response.ok) {
        const nested = object(data) && data.error?.data;
        const details = object(nested) ? nested : object(data) ? data : {error:"invalid_http_response",http_status:response.status};
        throw new PaymentAdmissionError(response.status,details,trace,requirement);
      }
      if (!object(data)) throw new Error("Evaluation returned an invalid JSON object");
      if (data.error || data.isError) throw new Error("Evaluation returned an error");
      return decode(data);
    } finally { clearTimeout(timeout); busy=false; }
  }
  return Object.freeze({evaluate:send, hasPayment:()=>Boolean(tx || standard),
    getPaymentResponse:()=>paymentResponse ? structuredClone(paymentResponse) : null,
    retryWithPayment:async(proof:PaymentProof={})=>{
      if (busy) throw new Error("This call is already running");
      retain(proof);
      if (!tx && !standard) throw new Error("Supply an existing payment transaction hash or signed x402 payment proof");
      return send();
    }});
}
