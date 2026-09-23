// Synthetic demonstration only; parameterization never turns inputs into verified findings.
const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
export function buildDossierModel(params = {}) {
  return {
    deal_ref: String(params.deal_ref || "SYNTHETIC-CASPIAN-001"),
    cargo: String(params.cargo || params.commodity || "Illustrative industrial valves"),
    hs_code: String(params.hs_code || "8481.80 — caller-declared; classification unverified"),
    shipper: String(params.shipper || params.seller || "Synthetic Supplier A"),
    consignee: String(params.consignee || params.buyer || "Synthetic Buyer B"),
    transit_route: String(params.transit_route || params.transit || params.route || "Illustrative Antwerp–Poti–Baku–Aktau route"),
    verdict: "INSUFFICIENT_INFORMATION", readiness_score: 0,
    jws_signature: null, human_review_required: true
  };
}
export function sampleDossierMd(params = {}) {
 const d = buildDossierModel(params);
 return `# Synthetic evidence-review dossier

**Synthetic demonstration — not a completed client audit. Not certified, signed or accepted by a bank.**

Reference: ${d.deal_ref}
Cargo (declared): ${d.cargo}
HS code (declared): ${d.hs_code}
Supplier (declared): ${d.shipper}
Buyer (declared): ${d.consignee}
Route (declared): ${d.transit_route}

## Evidence gaps
1. Classification: no technical specification or classification opinion supplied. Do not infer CHPL Tier 3.B from HS 8481.80. The published BIS CHPL uses six-digit codes and does not list 8481.80. Other export restrictions require separate review.
2. Ownership: no verified shareholder register or complete ownership chain. A fictional minority percentage cannot establish sanctions clearance.
3. Logistics: no vessel registry or AIS dataset supplied; no maritime clean finding is made.
4. Documents: end-user, origin, invoice and shipment evidence must be collected and independently assessed.
5. Review: INSUFFICIENT_INFORMATION. No payment, shipment, licence or financing decision is authorized.

## Sources and scope
BIS Common High Priority Items List (published 23 February 2024): https://media.bis.gov/licensing/country-guidance/common-high-priority-items-list-chpl
List reference checked 23 September 2026. This sample does not perform live retrieval. All parties and transaction facts above are synthetic defaults or caller declarations, not verified findings.

## Attestation
No cryptographic attestation is issued for this template. jws_signature: null. A real signed receipt would identify the exact payload hash, policy version, signing key and scope, and require independent signature verification. A signature does not establish factual truth.

See /privacy for processing and retention boundaries. Contact the operator to agree a human review scope.
`;
}
export const SAMPLE_DOSSIER_MD = sampleDossierMd();
export function sampleDossierHtml(params = {}) {
 return `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Synthetic evidence-review dossier</title><style>body{font:16px/1.6 system-ui;max-width:850px;margin:40px auto;padding:24px;color:#172033}pre{white-space:pre-wrap;overflow-wrap:anywhere;font:inherit}@media print{nav{display:none}@page{size:A4;margin:18mm}}</style><nav><a href="/">Product</a> · <a href="/sample-dossier.md">Markdown</a> · <button onclick="window.print()">Print / Save as PDF</button></nav><pre>${escapeHtml(sampleDossierMd(params))}</pre></html>`;
}
function respond(request, params = {}) {
 const url = new URL(request.url);
 const md = url.pathname.endsWith(".md") || url.searchParams.get("format") === "md" || /text\/(markdown|plain)/.test(request.headers.get("accept") || "");
 return new Response(md ? sampleDossierMd(params) : sampleDossierHtml(params), {headers:{"content-type": md ? "text/markdown; charset=utf-8" : "text/html; charset=utf-8", "cache-control":"no-store", "access-control-allow-origin":"*"}});
}
export function handleSampleDossierRequest(request) { return respond(request); }
export async function handleDossierExportRequest(request) {
 let params = Object.fromEntries(new URL(request.url).searchParams);
 if (request.method === "POST") {
   try { const body = await request.json(); if (body && typeof body === "object" && !Array.isArray(body)) params = {...params, ...body}; }
   catch { return new Response("Invalid JSON", {status:400}); }
 }
 return respond(request, params);
}
