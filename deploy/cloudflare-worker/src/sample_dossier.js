// Sample Redacted Deal Dossier for Agenda Intelligence.
// Demonstrates the 5-factor forensic audit delivered for institutional trade finance
// and bank compliance committees with cryptographic Vizier JWS verification.

export const SAMPLE_DOSSIER_MD = `# CONFIDENTIAL DEAL DOSSIER — REDACTED AUDIT REPORT
**Document Reference:** \`DOSSIER-REF-2026-09-CASPIAN-4091\`  
**Evaluation Standard:** Vizier 5-Factor Kernel v1.9 / ICC UCP 600 / OFAC EO 14114  
**Audit Timestamp:** 2026-09-16T14:30:00Z  
**Cryptographic Attestation:** Vizier JWS (ES256) \`jws_0a9b8f3e2d1c...\`  
**Security Posture:** Zero-Retention (Processed entirely in volatile Edge RAM)

---

## 1. TRANSACTION EXECUTIVE SUMMARY

| Field | Declared Deal Parameter | Verification Status |
| :--- | :--- | :--- |
| **Transaction Ref** | LC-KZ-2026-9921 / Documentary Letter of Credit | **Screened** |
| **Transaction Value** | \$1,480,000.00 USD | **High-Value Threshold Exceeded** |
| **Declared Cargo** | Industrial High-Pressure Flow Valves & Regulators | **CHPL Tier 3.B Flagged** |
| **Declared HS Code** | \`8481.80.81\` (Flow Control Valves) | **CHPL / Dual-Use Annex VII** |
| **Shipper / Origin** | Precision Valve Engineering N.V. (Antwerp, Belgium) | **Verified EU Exporter** |
| **Consignee / Buyer** | Central Asia Industrial Supplies LLP (Almaty, Kazakhstan) | **Beneficial Ownership Risk** |
| **Transit Route** | Antwerp (BE) → Poti (GE) → Baku (AZ) → Aktau (KZ) → Almaty (KZ) | **Trans-Caspian Corridor** |
| **Advising / Issuing Bank** | Global Trade Bank (Singapore Branch) | **Secondary Sanctions Screening Required** |

---

## 2. FIVE-FACTOR FORENSIC AUDIT MATRIX

### Factor 1: Dual-Use & Export Control Screening (CHPL & EAR)
* **HS Code Screening (\`8481.80\`):**
  - Matched against **Common High Priority Items List (CHPL) Tier 3.B** (Dual-use industrial hardware).
  - Matched against **EU Council Regulation 833/2014, Annex VII** (Advanced technology & goods capable of industrial manufacturing / military diversion).
* **Diversion Risk Assessment:**
  - The destination jurisdiction (Kazakhstan) is subject to heightened monitoring for transshipment diversion under US BIS and EU Sanctions Envoy guidance.
* **Finding:** Mandatory **End-User Certificate (EUC)** containing strict non-re-export covenants to prohibited jurisdictions is required prior to LC issuance.

### Factor 2: Beneficial Ownership & OFAC 50% Rule Audit (UBO Graph)
* **Ultimate Beneficial Ownership Analysis:**
  - Consignee: *Central Asia Industrial Supplies LLP* (Registered: Almaty, KZ).
  - Shareholder Structure: 
    - 66% held by local non-sanctioned resident individuals.
    - 34% held via *Helios Meridian Holdings Ltd* (Limassol, Cyprus).
  - Deep UBO Graph Traversal:
    - *Helios Meridian Holdings Ltd* is 100% controlled by an individual designated under **OFAC SDN List** (Executive Order 14024).
* **Legal Finding under OFAC Rules:**
  - **Strict 50% Rule Status:** **PASS (34% < 50%)**. The entity is *not* blocked by operation of law.
  - **Secondary Sanctions Risk (EO 14114):** **CRITICAL RISK**. Under EO 14114, foreign financial institutions facilitating transactions involving entities connected to Russia's military-industrial supply chain face secondary sanctions and loss of US correspondent accounts.
  - **Bank Action:** Financing institution cannot process payment without specialized OFAC general license or complete restructuring of equity.

### Factor 3: Maritime & Transit Logistics Exposure
* **Vessel & Transshipment Audit:**
  - Rail legs (Antwerp → Poti and Baku → Aktau): Screened against state-owned railway sanctions lists (Clear).
  - Caspian Sea Ferry Crossing: Transshipment scheduled on Ro-Ro Vessel *Caspian Voyager* (IMO 9182345, Azerbaijan flag).
* **Deceptive Shipping Practices (AIS Analysis):**
  - Vessel IMO 9182345 evaluated for AIS dark activity, flag-hopping, and ship-to-ship (STS) transfers over the trailing 180 days.
  - **Status:** **CLEAN**. Normal operational track recorded between Port of Alat (Baku) and Port of Kuryk/Aktau.

### Factor 4: Evidence Gaps & Missing Source Ingestion
* **Documentary Audit against ICC UCP 600 Standards:**
  - \`[x]\` Clean On-Board Bill of Lading (Antwerp → Poti) — Submitted & Validated.
  - \`[x]\` Commercial Invoice & Packing List — Matched.
  - \`[!]\` **GAP 1:** Certified Manufacturer Test Report (MTR) specifying metallurgical tolerances missing.
  - \`[!]\` **GAP 2:** Signed End-User Certificate (EUC) with authenticated physical warehouse address in Almaty missing.
  - \`[!]\` **GAP 3:** Formal OFAC EO 14114 Non-Diversion Warranty from buyer missing.

### Factor 5: Deterministic Decision Gate & Recommendation
* **Decision Readiness Score:** **42 / 100** (\`NOT_DECISION_READY\`)
* **Gate Verdict:** **\`PRE_SIGNATURE_ESCALATE\`**
* **Mandatory Action:**
  1. **DO NOT SIGN OR FUND** the Letter of Credit in current documentary state.
  2. Require Buyer to provide authenticated End-User Certificate and eliminate the 34% SDN minority ownership link.
  3. Require physical delivery verification covenant before final cargo release in Almaty.

---

## 3. VIZIER CRYPTOGRAPHIC NON-REPUDIATION RECEIPT

\`\`\`json
{
  "receipt_version": "1.0",
  "dossier_id": "DOSSIER-REF-2026-09-CASPIAN-4091",
  "evaluated_at": "2026-09-16T14:30:00.184Z",
  "algorithm": "ES256",
  "key_id": "vizier-edge-signer-2026",
  "input_payload_sha256": "4f8a3d92e10a8b94f1c938d2f09458231498b8c194e82b7194f1a23b91c824a1",
  "gate_profile": "middle_corridor_deal_risk_gate",
  "verdict": "pre_signature_escalate",
  "readiness_score": 42,
  "human_review_required": true,
  "jws_signature": "eyJhbGciOiJFUzI1NiIsImtpZCI6InZpemllci1lZGdlLXNpZ25lci0yMDI2In0.eyJzdWIiOiJkZWFsLWRvc3NpZXIiLCJpc3MiOiJ2aXppZXItZWRnZS1rZXJuZWwiLCJpYXQiOjE3ODk0OTQ2MDAsInZlcmRpY3QiOiJwcmVfc2lnbmF0dXJlX2VzY2FsYXRlIn0.MEQCIE2y1k9g7L3p6qR...[cryptographically verifiable]"
}
\`\`\`

> **Confidentiality & Compliance Note:**  
> This dossier was generated by Agenda Intelligence Edge Infrastructure under strict Zero-Retention terms: no customer contract terms, banking details, or counterparty PII are persisted to disk or databases. Deterministic verification performed in volatile Edge RAM.
`;

export function sampleDossierHtml() {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Sample Redacted Deal Dossier — Agenda Intelligence</title>
<style>
  :root {
    --fg: #1a1a1a; --muted: #555555; --line: #e2e8f0;
    --bg: #f8fafc; --card: #ffffff; --accent: #0f4c81;
    --good: #166534; --warn: #9a3412; --danger: #991b1b;
    --mono: ui-monospace, "SF Mono", Menlo, Consolas, monospace;
    --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Inter, Helvetica, Arial, sans-serif;
  }
  * { box-sizing: border-box; }
  body { font-family: var(--sans); color: var(--fg); background: var(--bg); margin: 0; line-height: 1.6; }
  main { max-width: 840px; margin: 0 auto; padding: 40px 24px 96px; }
  .header { border-bottom: 2px solid var(--accent); padding-bottom: 20px; margin-bottom: 28px; }
  .top-meta { display: flex; justify-content: space-between; flex-wrap: wrap; gap: 10px; margin-bottom: 12px; font-family: var(--mono); font-size: 13px; color: var(--muted); }
  h1 { font-size: 24px; margin: 0 0 6px; letter-spacing: -0.01em; color: var(--accent); }
  .subtitle { font-size: 15px; color: var(--muted); margin: 0; }
  .pill-row { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 14px; }
  .pill { display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 999px; font-size: 12px; font-family: var(--mono); border: 1px solid var(--line); background: #fff; font-weight: 600; }
  .pill-danger { background: #fee2e2; color: var(--danger); border-color: #fca5a5; }
  .pill-good { background: #dcfce7; color: var(--good); border-color: #86efac; }
  .pill-accent { background: #e0f2fe; color: var(--accent); border-color: #7dd3fc; }
  
  .card { background: var(--card); border: 1px solid var(--line); border-radius: 8px; padding: 20px 24px; margin: 0 0 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.03); }
  h2 { font-size: 16px; margin: 0 0 16px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--accent); border-bottom: 1px solid var(--line); padding-bottom: 8px; }
  h3 { font-size: 15px; margin: 16px 0 8px; }
  
  table { width: 100%; border-collapse: collapse; font-size: 14px; margin-bottom: 12px; }
  th, td { text-align: left; padding: 8px 12px; border-bottom: 1px solid var(--line); }
  th { background: #f1f5f9; color: var(--muted); font-size: 12px; text-transform: uppercase; letter-spacing: 0.04em; }
  td code { font-family: var(--mono); font-size: 13px; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; }
  
  .factor-box { border-left: 4px solid var(--accent); padding: 12px 16px; background: #f8fafc; border-radius: 0 6px 6px 0; margin-bottom: 16px; }
  .factor-box.warn { border-left-color: #ea580c; background: #fff7ed; }
  .factor-box.danger { border-left-color: #dc2626; background: #fef2f2; }
  .factor-box.good { border-left-color: #16a34a; background: #f0fdf4; }
  
  pre { background: #0f172a; color: #f8fafc; padding: 16px; border-radius: 6px; overflow-x: auto; font-family: var(--mono); font-size: 12px; line-height: 1.5; margin: 0; }
  .btn-row { display: flex; gap: 12px; margin-top: 24px; flex-wrap: wrap; }
  .btn { display: inline-flex; align-items: center; padding: 10px 20px; border-radius: 6px; font-weight: 600; text-decoration: none; font-size: 14px; border: none; cursor: pointer; }
  .btn-primary { background: var(--accent); color: #fff; }
  .btn-secondary { background: #fff; color: var(--fg); border: 1px solid var(--line); }
  .btn-primary:hover { opacity: 0.95; }
  footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid var(--line); font-size: 13px; color: var(--muted); }
</style>
</head>
<body>
<main>
  <div class="header">
    <div class="top-meta">
      <span>REF: DOSSIER-REF-2026-09-CASPIAN-4091</span>
      <span>STANDARD: VIZIER 5-FACTOR KERNEL v1.9</span>
      <span>STATUS: AUDIT COMPLETE</span>
    </div>
    <h1>Confidential Deal Dossier (Redacted Audit Report)</h1>
    <p class="subtitle">Institutional 5-Factor Trade Risk, Secondary Sanctions & Dual-Use Clearance for Bank Compliance Committees</p>
    <div class="pill-row">
      <span class="pill pill-danger">VERDICT: PRE_SIGNATURE_ESCALATE</span>
      <span class="pill pill-accent">READINESS: 42/100</span>
      <span class="pill pill-danger">OFAC EO 14114 EXPOSURE</span>
      <span class="pill pill-good">VIZIER ES256 SIGNED</span>
      <span class="pill">ZERO-RETENTION GUARANTEED</span>
    </div>
  </div>

  <div class="card">
    <h2>1. Transaction Executive Summary</h2>
    <table>
      <thead>
        <tr><th>Parameter</th><th>Declared Deal Spec</th><th>Verification Status</th></tr>
      </thead>
      <tbody>
        <tr><td><strong>Transaction Instrument</strong></td><td>Irrevocable Documentary Letter of Credit (LC)</td><td><code>Screened vs UCP 600</code></td></tr>
        <tr><td><strong>Transaction Value</strong></td><td>\$1,480,000.00 USD</td><td><span style="color: var(--danger); font-weight: 600;">High-Value Threshold Exceeded</span></td></tr>
        <tr><td><strong>Declared Cargo</strong></td><td>Industrial High-Pressure Valves & Regulators</td><td><span style="color: var(--warn); font-weight: 600;">CHPL Tier 3.B Matched</span></td></tr>
        <tr><td><strong>Declared HS Code</strong></td><td><code>8481.80.81</code> (Flow Control)</td><td><code>EU Reg 833/2014 Annex VII</code></td></tr>
        <tr><td><strong>Shipper / Origin</strong></td><td>Precision Valve Engineering N.V. (Antwerp, Belgium)</td><td><span style="color: var(--good);">Verified EU Exporter</span></td></tr>
        <tr><td><strong>Consignee / Buyer</strong></td><td>Central Asia Industrial Supplies LLP (Almaty, Kazakhstan)</td><td><span style="color: var(--danger); font-weight: 600;">34% SDN Equity Link Detected</span></td></tr>
        <tr><td><strong>Transit Corridor</strong></td><td>Antwerp → Poti → Baku → Aktau → Almaty</td><td><code>Trans-Caspian Middle Corridor</code></td></tr>
      </tbody>
    </table>
  </div>

  <div class="card">
    <h2>2. Five-Factor Forensic Audit Matrix</h2>
    
    <div class="factor-box warn">
      <h3>Factor 1: Dual-Use & Export Control (CHPL & EAR)</h3>
      <p style="margin: 0 0 6px; font-size: 14px;"><strong>Finding:</strong> HS Code <code>8481.80</code> is classified under <strong>Common High Priority Items List (CHPL) Tier 3.B</strong> and EU Regulation 833/2014 Annex VII. High risk of diversion to sanctioned industrial programs.</p>
      <p style="margin: 0; font-size: 13px; color: var(--muted);"><strong>Requirement:</strong> Mandatory End-User Certificate (EUC) with verifiable physical site address in Kazakhstan required prior to shipment.</p>
    </div>

    <div class="factor-box danger">
      <h3>Factor 2: Beneficial Ownership & OFAC 50% Rule (UBO Graph)</h3>
      <p style="margin: 0 0 6px; font-size: 14px;"><strong>Finding:</strong> Deep graph traversal revealed that 34% of the buyer is held by a Cyprus vehicle (<em>Helios Meridian Holdings Ltd</em>) owned by an OFAC SDN-designated individual.</p>
      <p style="margin: 0; font-size: 13px; color: var(--muted);"><strong>Legal Assessment:</strong> Strictly passes OFAC 50% Rule (34% &lt; 50%), but creates extreme <strong>Secondary Sanctions Exposure under Executive Order 14114</strong> for participating financing banks. Direct grounds for transaction freeze by correspondent banks.</p>
    </div>

    <div class="factor-box good">
      <h3>Factor 3: Maritime & Logistics Route Exposure</h3>
      <p style="margin: 0 0 6px; font-size: 14px;"><strong>Finding:</strong> Rail legs via Georgia and Azerbaijan are clear of designated state entities. Caspian ferry crossing scheduled on Ro-Ro Vessel <em>Caspian Voyager</em> (IMO 9182345).</p>
      <p style="margin: 0; font-size: 13px; color: var(--muted);"><strong>Deceptive Shipping:</strong> Zero AIS gap history, zero STS transfers detected in past 180 days. Vessel is verified clean.</p>
    </div>

    <div class="factor-box warn">
      <h3>Factor 4: Evidence Gaps & Missing Sources</h3>
      <ul style="margin: 0; padding-left: 18px; font-size: 13px; color: var(--muted);">
        <li><strong style="color: var(--danger);">Missing:</strong> Manufacturer Inspection Certificate verifying alloy tolerances.</li>
        <li><strong style="color: var(--danger);">Missing:</strong> Physical End-User premises validation in Almaty.</li>
        <li><strong style="color: var(--danger);">Missing:</strong> Explicit OFAC EO 14114 Non-Diversion Covenant signed by buyer.</li>
      </ul>
    </div>

    <div class="factor-box danger">
      <h3>Factor 5: Verdict & Actionable Recommendation</h3>
      <p style="font-size: 15px; font-weight: 700; color: var(--danger); margin: 0 0 4px;">VERDICT: PRE_SIGNATURE_ESCALATE (Readiness Score: 42/100)</p>
      <p style="margin: 0; font-size: 14px;"><strong>Action for Credit Committee:</strong> DO NOT ISSUE OR CONFIRM LETTER OF CREDIT. Demand restructuring of the 34% SDN minority equity link and authenticated End-User Certificate before proceeding.</p>
    </div>
  </div>

  <div class="card">
    <h2>3. Vizier Cryptographic Non-Repudiation Receipt</h2>
    <p style="font-size: 13px; color: var(--muted); margin-bottom: 12px;">This receipt is signed on the edge using ES256 (ECDSA P-256) and forms a tamper-evident audit trail for bank regulatory compliance.</p>
    <pre>{
  "receipt_version": "1.0",
  "dossier_id": "DOSSIER-REF-2026-09-CASPIAN-4091",
  "evaluated_at": "2026-09-16T14:30:00.184Z",
  "algorithm": "ES256",
  "key_id": "vizier-edge-signer-2026",
  "input_payload_sha256": "4f8a3d92e10a8b94f1c938d2f09458231498b8c194e82b7194f1a23b91c824a1",
  "gate_profile": "middle_corridor_deal_risk_gate",
  "verdict": "pre_signature_escalate",
  "readiness_score": 42,
  "human_review_required": true,
  "jws_signature": "eyJhbGciOiJFUzI1NiIsImtpZCI6InZpemllci1lZGdlLXNpZ25lci0yMDI2In0..."
}</pre>
  </div>

  <div class="btn-row">
    <a href="/sample-dossier.md" class="btn btn-secondary">Raw Markdown (.md)</a>
    <a href="/" class="btn btn-primary">Return to Edge Gateway</a>
  </div>

  <footer>
    <p>Agenda Intelligence Edge Infrastructure • Zero-Retention: no customer deal data or PII is retained on disk or databases. Audit executed purely in volatile Edge RAM with deterministic rules.</p>
  </footer>
</main>
</body>
</html>`;
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
