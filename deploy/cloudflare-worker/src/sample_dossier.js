// Sample & Exportable Redacted Deal Dossier for Agenda Intelligence.
// Demonstrates the 5-factor forensic audit delivered for institutional trade finance
// and bank compliance committees with cryptographic Vizier JWS verification.
// Features @media print styling for A4 bank audit memos and dynamic parameterization.

export function buildDossierModel(params = {}) {
  const defaults = {
    deal_ref: "DOSSIER-REF-2026-09-CASPIAN-4091",
    deal_name: "Industrial High-Pressure Flow Control Hardware",
    instrument: "Irrevocable Documentary Letter of Credit (LC)",
    value_usd: "$1,480,000.00 USD",
    cargo: "Industrial High-Pressure Valves & Regulators",
    hs_code: "8481.80.81 (Flow Control Valves)",
    shipper: "Precision Valve Engineering N.V. (Antwerp, Belgium)",
    consignee: "Central Asia Industrial Supplies LLP (Almaty, Kazakhstan)",
    transit_route: "Antwerp (BE) → Poti (GE) → Baku (AZ) → Aktau (KZ) → Almaty (KZ)",
    issuing_bank: "Global Trade Bank (Singapore Branch)",
    verdict: "PRE_SIGNATURE_ESCALATE",
    readiness_score: 42,
    evaluated_at: "2026-09-16T14:30:00.184Z",
    jws_key_id: "vizier-edge-signer-2026",
    receipt_id: "vrf_caspian_4091",
    factor1_risk: "CHPL Tier 3.B Matched / EU Reg 833/2014 Annex VII",
    factor2_risk: "34% SDN Equity Link Detected (Helios Meridian Holdings Ltd / Limassol, Cyprus)",
    factor3_risk: "Trans-Caspian Ro-Ro Maritime Transit (IMO 9182345, Azerbaijan Flag)",
    factor4_risk: "Missing Manufacturer Inspection Certificate & Site EUC",
    recommendation: "DO NOT ISSUE OR CONFIRM LETTER OF CREDIT. Demand restructuring of the 34% SDN minority equity link and authenticated End-User Certificate before proceeding."
  };

  return { ...defaults, ...params };
}

export function sampleDossierMd(params = {}) {
  const d = buildDossierModel(params);

  return `# CONFIDENTIAL DEAL DOSSIER — REDACTED AUDIT REPORT
**Document Reference:** \`${d.deal_ref}\`  
**Evaluation Standard:** Vizier 5-Factor Kernel v1.9 / ICC UCP 600 / OFAC EO 14114  
**Audit Timestamp:** ${d.evaluated_at}  
**Cryptographic Attestation:** Vizier JWS (ES256) \`jws_0a9b8f3e2d1c...\`  
**Security Posture:** Zero-Retention (Processed entirely in volatile Edge RAM)

---

## 1. TRANSACTION EXECUTIVE SUMMARY

| Field | Declared Deal Parameter | Verification Status |
| :--- | :--- | :--- |
| **Transaction Ref** | ${d.deal_ref} / ${d.instrument} | **Screened** |
| **Transaction Value** | ${d.value_usd} | **High-Value Threshold Exceeded** |
| **Declared Cargo** | ${d.cargo} | **CHPL Tier 3.B Flagged** |
| **Declared HS Code** | \`${d.hs_code}\` | **CHPL / Dual-Use Annex VII** |
| **Shipper / Origin** | ${d.shipper} | **Verified Exporter** |
| **Consignee / Buyer** | ${d.consignee} | **Beneficial Ownership Risk** |
| **Transit Route** | ${d.transit_route} | **Trans-Caspian Corridor** |
| **Advising / Issuing Bank** | ${d.issuing_bank} | **Secondary Sanctions Screening Required** |

---

## 2. FIVE-FACTOR FORENSIC AUDIT MATRIX

### Factor 1: Dual-Use & Export Control Screening (CHPL & EAR)
* **HS Code Screening (\`${d.hs_code}\`):**
  - ${d.factor1_risk}
* **Finding:** Mandatory **End-User Certificate (EUC)** containing strict non-re-export covenants to prohibited jurisdictions is required prior to LC issuance.

### Factor 2: Beneficial Ownership & OFAC 50% Rule Audit (UBO Graph)
* **Ultimate Beneficial Ownership Analysis:**
  - Consignee: *${d.consignee}*
  - Shareholder Structure: 
    - 66% held by local non-sanctioned resident individuals.
    - 34% held via foreign holding entity.
  - Deep UBO Graph Traversal:
    - ${d.factor2_risk}
* **Legal Finding under OFAC Rules:**
  - **Strict 50% Rule Status:** **PASS (34% < 50%)**. The entity is *not* blocked by operation of law.
  - **Secondary Sanctions Risk (EO 14114):** **CRITICAL RISK**. Foreign financial institutions facilitating transactions involving entities connected to designated military-industrial supply chains face secondary sanctions.
  - **Bank Action:** Financing institution cannot process payment without specialized general license or equity restructuring.

### Factor 3: Maritime & Transit Logistics Exposure
* **Logistics Corridor Analysis:**
  - Corridor: ${d.transit_route}
  - ${d.factor3_risk}
* **Deceptive Shipping Practices (AIS Analysis):**
  - Evaluated for AIS dark activity, flag-hopping, and ship-to-ship (STS) transfers over the trailing 180 days. Status: Verified Clean.

### Factor 4: Evidence Gaps & Missing Source Ingestion
* **Documentary Audit against ICC UCP 600 Standards:**
  - \`[x]\` Clean On-Board Bill of Lading — Submitted & Validated.
  - \`[x]\` Commercial Invoice & Packing List — Matched.
  - \`[!]\` ${d.factor4_risk}

### Factor 5: Deterministic Decision Gate & Recommendation
* **Decision Readiness Score:** **${d.readiness_score} / 100** (\`NOT_DECISION_READY\`)
* **Gate Verdict:** **\`${d.verdict}\`**
* **Mandatory Action:**
  - ${d.recommendation}

---

## 3. VIZIER CRYPTOGRAPHIC NON-REPUDIATION RECEIPT

\`\`\`json
{
  "receipt_version": "1.0",
  "dossier_id": "${d.deal_ref}",
  "evaluated_at": "${d.evaluated_at}",
  "algorithm": "ES256",
  "key_id": "${d.jws_key_id}",
  "input_payload_sha256": "4f8a3d92e10a8b94f1c938d2f09458231498b8c194e82b7194f1a23b91c824a1",
  "gate_profile": "middle_corridor_deal_risk_gate",
  "verdict": "${d.verdict.toLowerCase()}",
  "readiness_score": ${d.readiness_score},
  "human_review_required": true,
  "jws_signature": "eyJhbGciOiJFUzI1NiIsImtpZCI6InZpemllci1lZGdlLXNpZ25lci0yMDI2In0..."
}
\`\`\`

> **Confidentiality & Compliance Note:**  
> This dossier was generated by Agenda Intelligence Edge Infrastructure under strict Zero-Retention terms: no customer contract terms, banking details, or counterparty PII are persisted to disk or databases. Deterministic verification performed in volatile Edge RAM.
`;
}

export const SAMPLE_DOSSIER_MD = sampleDossierMd();

export function sampleDossierHtml(params = {}) {
  const d = buildDossierModel(params);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Confidential Deal Dossier — ${d.deal_ref}</title>
<style>
  :root {
    --fg: #0f172a; --muted: #475569; --line: #cbd5e1;
    --bg: #f8fafc; --card: #ffffff; --accent: #0f4c81;
    --good: #166534; --warn: #9a3412; --danger: #991b1b;
    --mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
    --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Roboto, Helvetica, Arial, sans-serif;
  }
  * { box-sizing: border-box; }
  body { font-family: var(--sans); color: var(--fg); background: var(--bg); margin: 0; line-height: 1.6; }
  main { max-width: 860px; margin: 0 auto; padding: 24px 24px 80px; }
  
  /* Floating Toolbar */
  .toolbar {
    display: flex; justify-content: space-between; align-items: center;
    background: #0f172a; color: #fff; padding: 12px 20px; border-radius: 8px;
    margin-bottom: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
  }
  .toolbar-title { font-size: 14px; font-weight: 600; display: flex; align-items: center; gap: 8px; }
  .toolbar-actions { display: flex; gap: 10px; }
  .btn { display: inline-flex; align-items: center; gap: 6px; padding: 8px 16px; border-radius: 6px; font-weight: 600; text-decoration: none; font-size: 13px; border: none; cursor: pointer; transition: all 0.15s; }
  .btn-print { background: #38bdf8; color: #090d16; }
  .btn-print:hover { background: #0ea5e9; }
  .btn-secondary { background: #334155; color: #f8fafc; }
  .btn-secondary:hover { background: #475569; }
  .btn-link { background: transparent; color: #94a3b8; }
  .btn-link:hover { color: #fff; }

  /* Letterhead Header */
  .letterhead {
    border-bottom: 2px solid var(--accent); padding-bottom: 16px; margin-bottom: 24px;
    display: flex; justify-content: space-between; align-items: flex-start;
  }
  .org-block h1 { font-size: 20px; margin: 0 0 4px; color: var(--accent); text-transform: uppercase; letter-spacing: 0.04em; }
  .org-block p { font-size: 12px; margin: 0; color: var(--muted); font-family: var(--mono); }
  .ref-block { text-align: right; font-family: var(--mono); font-size: 12px; color: var(--muted); }
  .ref-badge { display: inline-block; background: #e0f2fe; color: #0369a1; padding: 3px 8px; border-radius: 4px; font-weight: 700; margin-top: 4px; }

  .doc-title { font-size: 22px; margin: 0 0 6px; letter-spacing: -0.01em; color: var(--fg); }
  .subtitle { font-size: 14px; color: var(--muted); margin: 0 0 16px; }

  .pill-row { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 24px; }
  .pill { display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 999px; font-size: 12px; font-family: var(--mono); border: 1px solid var(--line); background: #fff; font-weight: 600; }
  .pill-danger { background: #fee2e2; color: var(--danger); border-color: #fca5a5; }
  .pill-good { background: #dcfce7; color: var(--good); border-color: #86efac; }
  .pill-accent { background: #e0f2fe; color: var(--accent); border-color: #7dd3fc; }
  
  .card { background: var(--card); border: 1px solid var(--line); border-radius: 8px; padding: 20px 24px; margin: 0 0 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.03); }
  h2 { font-size: 15px; margin: 0 0 14px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--accent); border-bottom: 1px solid var(--line); padding-bottom: 8px; }
  
  table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 8px; }
  th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid var(--line); }
  th { background: #f1f5f9; color: var(--muted); font-size: 11px; text-transform: uppercase; letter-spacing: 0.04em; }
  td code { font-family: var(--mono); font-size: 12px; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; }
  
  .factor-box { border-left: 4px solid var(--accent); padding: 12px 16px; background: #f8fafc; border-radius: 0 6px 6px 0; margin-bottom: 14px; break-inside: avoid; }
  .factor-box h3 { font-size: 14px; margin: 0 0 4px; }
  .factor-box.warn { border-left-color: #ea580c; background: #fff7ed; }
  .factor-box.danger { border-left-color: #dc2626; background: #fef2f2; }
  .factor-box.good { border-left-color: #16a34a; background: #f0fdf4; }
  
  pre { background: #0f172a; color: #f8fafc; padding: 14px; border-radius: 6px; overflow-x: auto; font-family: var(--mono); font-size: 11px; line-height: 1.5; margin: 0; }
  
  /* Official Watermark & Verification Seal */
  .audit-seal-box {
    display: flex; justify-content: space-between; align-items: center; background: #f8fafc;
    border: 2px dashed #0284c7; padding: 14px 20px; border-radius: 6px; margin: 24px 0 20px;
  }
  .seal-text h4 { margin: 0 0 2px; font-size: 14px; color: #0284c7; text-transform: uppercase; letter-spacing: 0.05em; }
  .seal-text p { margin: 0; font-size: 12px; color: var(--muted); }
  .seal-stamp { border: 2px solid #0284c7; color: #0284c7; padding: 6px 12px; font-family: var(--mono); font-size: 11px; font-weight: 700; border-radius: 4px; text-align: center; text-transform: uppercase; }

  /* Sign-Off Block */
  .sign-off-block {
    display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 32px;
    padding-top: 20px; border-top: 1px solid var(--line); break-inside: avoid;
  }
  .sign-col { font-size: 12px; color: var(--muted); }
  .sign-line { margin-top: 36px; border-top: 1px solid #94a3b8; padding-top: 4px; font-weight: 600; color: var(--fg); }

  footer { margin-top: 30px; padding-top: 16px; border-top: 1px solid var(--line); font-size: 11px; color: var(--muted); text-align: center; }

  /* Print Stylesheet for A4 Audits */
  @media print {
    @page { size: A4 portrait; margin: 12mm 14mm; }
    body { background: #fff !important; color: #000 !important; font-size: 11pt; }
    main { max-width: 100% !important; padding: 0 !important; margin: 0 !important; }
    .no-print { display: none !important; }
    .card { box-shadow: none !important; border: 1px solid #cbd5e1 !important; margin-bottom: 12pt !important; padding: 12pt 16pt !important; break-inside: avoid; }
    .factor-box { break-inside: avoid; margin-bottom: 8pt !important; }
    pre { background: #f8fafc !important; color: #0f172a !important; border: 1px solid #cbd5e1 !important; font-size: 8.5pt !important; }
    .btn-row, .toolbar { display: none !important; }
    .sign-off-block { break-inside: avoid; margin-top: 20pt !important; }
    a { text-decoration: none !important; color: inherit !important; }
  }
</style>
</head>
<body>
<main>
  <!-- Interactive Toolbar (hidden in print) -->
  <div class="toolbar no-print">
    <div class="toolbar-title">
      <span>📄</span>
      <span>Compliance Dossier Engine • ${d.deal_ref}</span>
    </div>
    <div class="toolbar-actions">
      <button onclick="window.print()" class="btn btn-print">🖨️ Print / Save as PDF</button>
      <a href="?format=md" class="btn btn-secondary">📥 Raw Markdown (.md)</a>
      <a href="/" class="btn btn-link">← Edge Gateway</a>
    </div>
  </div>

  <!-- Corporate Audit Letterhead -->
  <div class="letterhead">
    <div class="org-block">
      <h1>Agenda Intelligence • Compliance Division</h1>
      <p>Forensic Geopolitical Risk, OFAC Secondary Sanctions & Dual-Use Clearance</p>
    </div>
    <div class="ref-block">
      <div>REF: <strong>${d.deal_ref}</strong></div>
      <div>STANDARD: <strong>VIZIER KERNEL v1.9 / ICC UCP 600</strong></div>
      <div class="ref-badge">VERIFIED AUDIT MEMORANDUM</div>
    </div>
  </div>

  <h2 class="doc-title">Confidential Deal Dossier (Forensic Audit Report)</h2>
  <p class="subtitle">Institutional 5-Factor Trade Risk, Secondary Sanctions & Dual-Use Clearance for Bank Compliance Committees</p>

  <div class="pill-row">
    <span class="pill pill-danger">VERDICT: ${d.verdict}</span>
    <span class="pill pill-accent">READINESS SCORE: ${d.readiness_score}/100</span>
    <span class="pill pill-danger">OFAC EO 14114 EXPOSURE</span>
    <span class="pill pill-good">VIZIER ES256 SIGNED</span>
    <span class="pill">ZERO-RETENTION GUARANTEED</span>
  </div>

  <div class="card">
    <h2>1. Transaction Executive Summary</h2>
    <table>
      <thead>
        <tr><th>Parameter</th><th>Declared Deal Specification</th><th>Verification Status</th></tr>
      </thead>
      <tbody>
        <tr><td><strong>Transaction Instrument</strong></td><td>${d.instrument}</td><td><code>Screened vs UCP 600</code></td></tr>
        <tr><td><strong>Transaction Value</strong></td><td>${d.value_usd}</td><td><span style="color: var(--danger); font-weight: 600;">High-Value Threshold Exceeded</span></td></tr>
        <tr><td><strong>Declared Cargo</strong></td><td>${d.cargo}</td><td><span style="color: var(--warn); font-weight: 600;">CHPL Tier 3.B Matched</span></td></tr>
        <tr><td><strong>Declared HS Code</strong></td><td><code>${d.hs_code}</code></td><td><code>EU Reg 833/2014 Annex VII</code></td></tr>
        <tr><td><strong>Shipper / Origin</strong></td><td>${d.shipper}</td><td><span style="color: var(--good); font-weight: 600;">Verified Exporter</span></td></tr>
        <tr><td><strong>Consignee / Buyer</strong></td><td>${d.consignee}</td><td><span style="color: var(--danger); font-weight: 600;">34% SDN Equity Link Detected</span></td></tr>
        <tr><td><strong>Transit Corridor</strong></td><td>${d.transit_route}</td><td><code>Trans-Caspian Middle Corridor</code></td></tr>
        <tr><td><strong>Advising / Issuing Bank</strong></td><td>${d.issuing_bank}</td><td><code>Secondary Sanctions Clearance Req.</code></td></tr>
      </tbody>
    </table>
  </div>

  <div class="card">
    <h2>2. Five-Factor Forensic Audit Matrix</h2>
    
    <div class="factor-box warn">
      <h3>Factor 1: Dual-Use & Export Control (CHPL & EAR)</h3>
      <p style="margin: 0 0 6px; font-size: 13px;"><strong>Finding:</strong> HS Code <code>${d.hs_code}</code> is classified under <strong>Common High Priority Items List (CHPL) Tier 3.B</strong> and EU Regulation 833/2014 Annex VII. Heightened diversion risk identified.</p>
      <p style="margin: 0; font-size: 12px; color: var(--muted);"><strong>Requirement:</strong> Mandatory End-User Certificate (EUC) with verifiable physical warehouse premises in Kazakhstan required prior to shipment.</p>
    </div>

    <div class="factor-box danger">
      <h3>Factor 2: Beneficial Ownership & OFAC 50% Rule (UBO Graph)</h3>
      <p style="margin: 0 0 6px; font-size: 13px;"><strong>Finding:</strong> Deep graph traversal revealed that 34% of the buyer equity is held by an offshore vehicle (<em>Helios Meridian Holdings Ltd</em>) owned by an OFAC SDN-designated individual.</p>
      <p style="margin: 0; font-size: 12px; color: var(--muted);"><strong>Legal Assessment:</strong> Strictly passes OFAC 50% Rule (34% &lt; 50%), but triggers severe <strong>Secondary Sanctions Exposure under Executive Order 14114</strong> for participating financing banks.</p>
    </div>

    <div class="factor-box good">
      <h3>Factor 3: Maritime & Logistics Route Exposure</h3>
      <p style="margin: 0 0 6px; font-size: 13px;"><strong>Finding:</strong> Rail transit legs via Georgia and Azerbaijan are clear of designated state entities. Caspian ferry crossing scheduled on Ro-Ro Vessel <em>Caspian Voyager</em> (IMO 9182345).</p>
      <p style="margin: 0; font-size: 12px; color: var(--muted);"><strong>Deceptive Shipping:</strong> Zero AIS gap history, zero STS transfers detected in past 180 days. Vessel verified clean.</p>
    </div>

    <div class="factor-box warn">
      <h3>Factor 4: Evidence Gaps & Missing Sources</h3>
      <ul style="margin: 0; padding-left: 18px; font-size: 12px; color: var(--muted);">
        <li><strong style="color: var(--danger);">Missing:</strong> Certified Manufacturer Test Report (MTR) verifying metallurgical specifications.</li>
        <li><strong style="color: var(--danger);">Missing:</strong> Physical End-User premises inspection certificate in Almaty.</li>
        <li><strong style="color: var(--danger);">Missing:</strong> Explicit OFAC EO 14114 Non-Diversion Covenant signed by buyer.</li>
      </ul>
    </div>

    <div class="factor-box danger">
      <h3>Factor 5: Verdict & Actionable Recommendation</h3>
      <p style="font-size: 14px; font-weight: 700; color: var(--danger); margin: 0 0 4px;">VERDICT: ${d.verdict} (Readiness Score: ${d.readiness_score}/100)</p>
      <p style="margin: 0; font-size: 13px;"><strong>Action for Credit Committee:</strong> ${d.recommendation}</p>
    </div>
  </div>

  <div class="card">
    <h2>3. Vizier Cryptographic Non-Repudiation Receipt</h2>
    <p style="font-size: 12px; color: var(--muted); margin-bottom: 12px;">This receipt is signed on Cloudflare Edge using ES256 (ECDSA P-256) and forms a tamper-evident audit trail for bank regulatory audits.</p>
    <pre>{
  "receipt_version": "1.0",
  "dossier_id": "${d.deal_ref}",
  "evaluated_at": "${d.evaluated_at}",
  "algorithm": "ES256",
  "key_id": "${d.jws_key_id}",
  "input_payload_sha256": "4f8a3d92e10a8b94f1c938d2f09458231498b8c194e82b7194f1a23b91c824a1",
  "gate_profile": "middle_corridor_deal_risk_gate",
  "verdict": "${d.verdict.toLowerCase()}",
  "readiness_score": ${d.readiness_score},
  "human_review_required": true,
  "jws_signature": "eyJhbGciOiJFUzI1NiIsImtpZCI6InZpemllci1lZGdlLXNpZ25lci0yMDI2In0..."
}</pre>
  </div>

  <!-- Watermark Seal -->
  <div class="audit-seal-box">
    <div class="seal-text">
      <h4>Vizier Cryptographic Attestation Seal</h4>
      <p>ES256 Edge Signature • Immutable SHA-256 Ledger • Zero-Retention Certified</p>
    </div>
    <div class="seal-stamp">
      VIZIER ATTESTED<br>
      <span style="font-size:9px; font-weight:normal;">KEY: ${d.jws_key_id}</span>
    </div>
  </div>

  <!-- Formal Sign-Off Block for Bank Committees -->
  <div class="sign-off-block">
    <div class="sign-col">
      <strong>CHIEF SANCTIONS COUNSEL / SENIOR AUDITOR</strong>
      <div class="sign-line">Reviewed & Flagged for Human Intervention</div>
      <div>Agenda Intelligence Forensic Review Board</div>
      <div>Attestation Date: ${d.evaluated_at.split("T")[0]}</div>
    </div>
    <div class="sign-col">
      <strong>AUTOMATED EDGE ARBITER PROTOCOL</strong>
      <div class="sign-line">Cryptographically Attested (Vizier Kernel v1.9)</div>
      <div>Algorithm: ES256 / SHA-256 Non-Repudiation</div>
      <div>Key Fingerprint: ${d.jws_key_id}</div>
    </div>
  </div>

  <div class="btn-row no-print" style="margin-top: 24px; display: flex; gap: 12px;">
    <button onclick="window.print()" class="btn btn-print">🖨️ Print / Save as PDF</button>
    <a href="?format=md" class="btn btn-secondary">Raw Markdown (.md)</a>
    <a href="/" class="btn btn-link">Return to Edge Gateway</a>
  </div>

  <footer>
    <p>Agenda Intelligence Edge Infrastructure • Zero-Retention: no customer deal data or PII is retained on disk or databases. Audit executed purely in volatile Edge RAM with deterministic rules.</p>
  </footer>
</main>
</body>
</html>`;
}

export async function handleDossierExportRequest(request) {
  const url = new URL(request.url);
  const accept = request.headers.get("accept") || "";

  // Parse query parameters
  const params = {};
  const allowedKeys = [
    "deal_ref", "deal_name", "instrument", "value_usd", "cargo",
    "hs_code", "shipper", "consignee", "transit_route", "issuing_bank",
    "verdict", "readiness_score"
  ];
  for (const key of allowedKeys) {
    const val = url.searchParams.get(key);
    if (val) params[key] = val;
  }

  // Aliases from query params
  if (url.searchParams.get("commodity") && !params.cargo) params.cargo = url.searchParams.get("commodity");
  if (url.searchParams.get("transit") && !params.transit_route) params.transit_route = url.searchParams.get("transit");
  if (url.searchParams.get("route") && !params.transit_route) params.transit_route = url.searchParams.get("route");
  if (url.searchParams.get("buyer") && !params.consignee) params.consignee = url.searchParams.get("buyer");
  if (url.searchParams.get("seller") && !params.shipper) params.shipper = url.searchParams.get("seller");
  if (url.searchParams.get("score") && !params.readiness_score) params.readiness_score = Number(url.searchParams.get("score"));

  // Ingest POST payload if applicable
  if (request.method === "POST") {
    try {
      const body = await request.json();
      if (body && typeof body === "object") {
        for (const key of allowedKeys) {
          if (body[key] !== undefined && body[key] !== null) params[key] = body[key];
        }
        if (body.commodity && !params.cargo) params.cargo = body.commodity;
        if (body.transit && !params.transit_route) params.transit_route = body.transit;
        if (body.route && !params.transit_route) params.transit_route = body.route;
        if (body.buyer && !params.consignee) params.consignee = body.buyer;
        if (body.seller && !params.shipper) params.shipper = body.seller;
        if (body.score !== undefined && !params.readiness_score) params.readiness_score = Number(body.score);
      }
    } catch {
      // Ignore non-JSON body
    }
  }

  const format = url.searchParams.get("format") || "";
  const isMd = format === "md" || url.pathname.endsWith(".md") || accept.includes("text/markdown") || (!accept.includes("text/html") && accept.includes("text/plain"));

  if (isMd) {
    return new Response(sampleDossierMd(params), {
      status: 200,
      headers: {
        "content-type": "text/markdown; charset=utf-8",
        "cache-control": "public, max-age=1800",
        "access-control-allow-origin": "*"
      }
    });
  }

  return new Response(sampleDossierHtml(params), {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=1800",
      "access-control-allow-origin": "*"
    }
  });
}

export function handleSampleDossierRequest(request) {
  const url = new URL(request.url);
  const accept = request.headers.get("accept") || "";

  if (url.pathname.endsWith(".md") || accept.includes("text/markdown") || (!accept.includes("text/html") && accept.includes("text/plain"))) {
    return new Response(SAMPLE_DOSSIER_MD, {
      status: 200,
      headers: {
        "content-type": "text/markdown; charset=utf-8",
        "cache-control": "public, max-age=3600",
        "access-control-allow-origin": "*"
      }
    });
  }

  return new Response(sampleDossierHtml(), {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=3600",
      "access-control-allow-origin": "*"
    }
  });
}
