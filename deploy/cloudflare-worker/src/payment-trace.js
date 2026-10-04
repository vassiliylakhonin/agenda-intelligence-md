// Optional, client-declared correlation only. Never an entitlement or request digest.
export function normalizePaymentTrace(value) {
  return typeof value === 'string' && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value)
    ? value.toLowerCase() : null;
}

export function paymentTraceId(request) {
  return normalizePaymentTrace(request.headers.get('x-payment-trace-id')) || crypto.randomUUID();
}

export function paymentTraceResponse(response, trace) {
  const headers = new Headers(response.headers);
  headers.set('X-Payment-Trace-Id', trace);
  const exposed = new Set((headers.get('access-control-expose-headers') || '').split(',').map(x => x.trim()).filter(Boolean));
  exposed.add('X-Payment-Trace-Id');
  headers.set('access-control-expose-headers', [...exposed].join(', '));
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
