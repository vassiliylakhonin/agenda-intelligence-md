/**
 * Deterministic Corridor Bankability Engine for Trans-Caspian & Middle Corridor Infrastructure.
 * Evaluates IFI financing covenants, corridor bottleneck constraints, currency mismatch risk,
 * and generates Freemium Teasers ($0) vs Full IFI Dossiers ($25 USDC via x402).
 */

import {
  BASE_USDC_CONTRACT,
  BASE_USDC_WALLET
} from "./profiles.js";

export const DSCR_FLOOR = 1.20;
export const DSCR_NON_SOVEREIGN_FLOOR = 1.30;
export const MAX_DEBT_SHARE = 0.80;
export const TIER_BANKABILITY_DOSSIER_USDC = 25.00;

export const CORRIDOR_BOTTLENECK_MAP = {
  "Aktau-Baku": "Aktau-Baku Caspian feeder crossing: water level drop (current levels require dated operator evidence) restricting vessel draft, wind-induced weather delays, and port turnaround times.",
  "Khorgos-Aktau": "Khorgos-Aktau rail transit: 1520mm / 1435mm gauge interchange at Dostyk/Altynkol and domestic wagon availability on Kazakhstan Temir Zholy (KTZ).",
  "Baku-Poti": "Baku-Poti Trans-Caucasus rail spine: Baku-Tbilisi-Kars (BTK) tunnel capacity and Georgian mountain pass single-track limits.",
  "Poti-Constanta": "Poti-Constanta Black Sea maritime leg: feeder schedule reliability, weather closures, and Romanian container terminal congestion at Constanta.",
  "MULTI_LEG": "Trans-Caspian multimodal interfaces: synchronization between railway wagons, port container yards, and maritime feeder schedules across 3 customs jurisdictions."
};

export const HUMAN_SIGNOFF_NOTICE =
  "Draft input for a named infrastructure finance professional to verify and sign. Not an approval, not a disbursement instruction, not financial or legal advice.";

export function evaluateCovenants(dscrMin, debtShare, hasSovereignGuarantee) {
  const checks = [];
  const conditions = [];

  if (hasSovereignGuarantee) {
    conditions.push("Supply the decree number or primary guarantee record and obtain legal review; a caller assertion does not waive debt-coverage screening.");
  }
  for (const [test,threshold] of [["minimum_dscr_floor",DSCR_FLOOR],["non_sovereign_dscr_margin",DSCR_NON_SOVEREIGN_FLOOR]]) {
    checks.push({test,threshold:`${threshold.toFixed(2)}x illustrative internal threshold`,observed_dscr:dscrMin,
      result:debtShare === 0 ? "NOT_APPLICABLE" : dscrMin >= threshold ? "PASSES" : "FAILS",
      basis:debtShare === 0 ? "No debt is proposed." : "Caller-supplied DSCR compared with a model assumption, not a lender covenant."});
  }
  if (dscrMin < DSCR_NON_SOVEREIGN_FLOOR && debtShare !== 0) conditions.push("Review cash flow, debt sizing and the illustrative 1.30x assumption with the lender before commitment.");

  if (debtShare === null || debtShare === undefined) {
    checks.push({
      test: "maximum_leverage",
      threshold: `debt share at or below ${(MAX_DEBT_SHARE * 100).toFixed(0)}% of capex`,
      observed_debt_share_pct: null,
      result: "NOT_APPLICABLE",
      basis: "capex was not supplied, leverage cannot be computed"
    });
    conditions.push("Supply total CAPEX and IFI debt so the leverage covenant can be validated.");
  } else {
    const leverageOk = debtShare <= MAX_DEBT_SHARE;
    checks.push({
      test: "maximum_leverage",
      threshold: `debt share at or below ${(MAX_DEBT_SHARE * 100).toFixed(0)}% of capex`,
      observed_debt_share_pct: Math.round(debtShare * 1000) / 10,
      result: leverageOk ? "PASSES" : "FAILS"
    });
    if (!leverageOk) {
      conditions.push(
        `IFI senior debt share of ${(debtShare * 100).toFixed(1)}% exceeds the ${(MAX_DEBT_SHARE * 100).toFixed(0)}% ceiling; sponsor equity contribution must be increased.`
      );
    }
  }

  return { checks, conditions };
}

export function validateBankabilityRequest(request) {
  if (!request || typeof request !== "object" || Array.isArray(request)) return ["Request must be an object"];
  const errors = [];
  if (typeof request.project_name !== "string" || request.project_name.trim().length < 2) errors.push("project_name must be a nonempty string");
  if (!Object.hasOwn(CORRIDOR_BOTTLENECK_MAP, request.corridor_leg)) errors.push("corridor_leg must be a supported corridor leg");
  for (const key of ["capex_usd_m", "ifi_debt_usd_m", "dscr_min"]) {
    if (!Number.isFinite(request[key]) || request[key] < 0 || (key === "capex_usd_m" && request[key] < 0.1)) errors.push(`${key} must be a finite ${key === "capex_usd_m" ? "positive" : "nonnegative"} number`);
  }
  if (request.ifi_debt_usd_m > request.capex_usd_m) errors.push("ifi_debt_usd_m cannot exceed capex_usd_m");
  for (const key of ["has_sovereign_guarantee", "currency_mismatch"]) {
    if (request[key] !== undefined && typeof request[key] !== "boolean") errors.push(`${key} must be a boolean`);
  }
  if (request.evidence_sources !== undefined && !Array.isArray(request.evidence_sources)) errors.push("evidence_sources must be an array");
  return errors;
}

export function generateBankabilityScreen(request = {}, isPaid = false, origin = "https://agenda-intelligence-a2a.vassiliy-lakhonin.workers.dev") {
  const errors = validateBankabilityRequest(request);
  if (errors.length) throw new TypeError(errors.join("; "));
  const projectName = request.project_name.trim();
  const corridorLeg = request.corridor_leg;
  const capexUsdM = request.capex_usd_m;
  const ifiDebtUsdM = request.ifi_debt_usd_m;
  const dscrMin = request.dscr_min;
  const hasSovereignGuarantee = request.has_sovereign_guarantee === true;
  const currencyMismatch = request.currency_mismatch !== false;
  const evidenceSources = Array.isArray(request.evidence_sources) ? request.evidence_sources : [];

  const debtShare = capexUsdM > 0 ? ifiDebtUsdM / capexUsdM : null;
  const { checks, conditions } = evaluateCovenants(dscrMin, debtShare, hasSovereignGuarantee);

  // Determine overall bankability status
  let bankabilityStatus = "CONDITIONALLY_BANKABLE";
  const floorCheck = checks.find((c) => c.test === "minimum_dscr_floor");
  const leverageCheck = checks.find((c) => c.test === "maximum_leverage");

  if ((floorCheck && floorCheck.result === "FAILS") || (leverageCheck && leverageCheck.result === "FAILS")) {
    bankabilityStatus = "HIGH_DEFAULT_RISK";
  } else if (dscrMin >= DSCR_NON_SOVEREIGN_FLOOR && debtShare !== null && debtShare > 0 && debtShare <= 0.70) {
    bankabilityStatus = "BANKABLE_CORE";
  }

  // Bottleneck summary
  const primaryBottleneck = CORRIDOR_BOTTLENECK_MAP[corridorLeg] || CORRIDOR_BOTTLENECK_MAP["MULTI_LEG"];

  // Credit Committee risk highlights
  const creditRisks = [];
  if (currencyMismatch) {
    const recommendedDsraUsdM = Math.round((ifiDebtUsdM / 15 * 0.5) * 100) / 100; // ~6 months debt service on 15y amort
    creditRisks.push({
      category: "FX_AND_CONVERTIBILITY_MISMATCH",
      severity: "HIGH",
      finding: "The declared or assumed currency mismatch requires verification of revenue and debt currencies; actual currency denominations have not been verified.",
      mitigant: `Illustrative 6-month principal-only reserve estimate: ~${recommendedDsraUsdM}M USD. Interest and fees excluded; confirm actual DSRA and FX terms with the lender.`
    });
  }

  creditRisks.push({
    category: "CORRIDOR_BOTTLENECK_EXPOSURE",
    severity: "MEDIUM",
    finding: primaryBottleneck,
    mitigant: "Include inter-operator SLA commitments and multi-modal throughput buffer in debt service sensitivity models."
  });

  if (hasSovereignGuarantee) {
    creditRisks.push({
      category: "SOVEREIGN_OBLIGATION_PERFECTION",
      severity: "MEDIUM",
      finding: "Sovereign guarantee referenced but requires issuer, scope, enforceability and applicable legal-form review.",
      mitigant: "Condition precedent to loan effectiveness."
    });
  }

  const baseResponse = {
    project_name: projectName,
    corridor_leg: corridorLeg,
    bankability_status: bankabilityStatus,
    status_scope: "illustrative_threshold_screen_not_credit_approval",
    financial_metrics: {
      total_capex_usd_m: capexUsdM,
      ifi_debt_usd_m: ifiDebtUsdM,
      debt_share_pct: debtShare !== null ? Math.round(debtShare * 1000) / 10 : null,
      dscr_minimum: dscrMin,
      has_sovereign_guarantee: hasSovereignGuarantee,
      currency_mismatch_flag: currencyMismatch
    },
    covenant_checks: checks,
    outstanding_conditions: conditions,
    corridor_bottleneck_analysis: {
      leg: corridorLeg,
      bottleneck_description: primaryBottleneck
    },
    credit_committee_risk_matrix: creditRisks,
    human_signoff_notice: HUMAN_SIGNOFF_NOTICE,
    human_review_required: true,
    human_signoff_required: true,
    evidence_label: "caller_supplied_unverified",
    model_scope: "illustrative_internal_thresholds_not_lender_approval",
    assumptions: { currency_mismatch: request.currency_mismatch === undefined ? "assumed_true" : "caller_supplied" },
    unlocked_full_dossier: isPaid
  };

  if (!isPaid) {
    // Return Free Decision Teaser + x402 unlock challenge
    baseResponse.x402_unlock = {
      protocol: "x402",
      network: "base",
      chain_id: 8453,
      token: "USDC",
      token_contract: BASE_USDC_CONTRACT,
      recipient_wallet: BASE_USDC_WALLET,
      amount_usdc: TIER_BANKABILITY_DOSSIER_USDC,
      amount_raw: String(Math.round(TIER_BANKABILITY_DOSSIER_USDC * 1e6)),
      includes_in_full_tier: [
        "15-Year Deterministic Debt Service Waterfall Model",
        "Illustrative scenario memo (Markdown only; no lender endorsement)",
        "List of caller-supplied evidence references for human review",
        "15-year JSON schedule with explicit scenario assumptions; no Excel/PDF file"
      ],
      how_to_unlock:
        `Send transfer(${BASE_USDC_WALLET}, ${String(Math.round(TIER_BANKABILITY_DOSSIER_USDC * 1e6))}) on Base (Chain ID 8453), then retry this request with header 'X-Payment-Tx: <tx_hash>'.`
    };
    return baseResponse;
  }

  // When paid: synthesize the full 7-section IFI Bankability Memo and financial waterfall
  const fullMemoMarkdown = `# IFI Corridor Bankability & Investment Memorandum
**Project**: ${projectName}  
**Corridor Leg**: ${corridorLeg}  
**Target Financial Institution**: European Bank for Reconstruction and Development (EBRD) / Asian Development Bank (ADB)  
**Scope**: Illustrative internal scenario; no EBRD, ADB or EU template certification

---

## 1. Executive Summary & Investment Thesis
The proposed ${projectName} comprises a total capital expenditure of \$${capexUsdM}M USD, seeking \$${ifiDebtUsdM}M USD in senior secured non-sovereign project finance. The project represents a critical strategic node on the Trans-Caspian International Transport Route (TITR / Middle Corridor). 

**Bankability Verdict**: **${bankabilityStatus}**  
Minimum Debt Service Coverage Ratio (DSCR): **${dscrMin.toFixed(2)}x** against an illustrative internal screening floor of ${DSCR_FLOOR.toFixed(2)}x. Senior leverage stands at **${(debtShare * 100).toFixed(1)}%**.

---

## 2. Debt Waterfall & Financial Profile (15-Year Horizon)
- **Total Capex**: \$${capexUsdM}M USD
- **Senior IFI Debt Tranche**: \$${ifiDebtUsdM}M USD (${(debtShare * 100).toFixed(1)}%)
- **Sponsor Equity Commitment**: \$${(capexUsdM - ifiDebtUsdM).toFixed(1)}M USD (${(100 - debtShare * 100).toFixed(1)}%)
- **Minimum DSCR**: ${dscrMin.toFixed(2)}x
- **Debt Service Reserve Account (DSRA)**: Illustrative 6-month principal-only estimate; interest, fees and lender requirements excluded (~${(ifiDebtUsdM / 15 * 0.5).toFixed(2)}M USD cash funded).
- **Illustrative Cash Sweep Option**: Discuss a 50% free cash flow sweep if DSCR drops below ${DSCR_NON_SOVEREIGN_FLOOR.toFixed(2)}x.

---

## 3. Corridor Bottlenecks & Hydrological Sensitivity
Primary physical and regulatory chokepoint on this segment:
> ${primaryBottleneck}

Obtain current operator and port records to assess draft capacity, load factors and terminal buffers; no site-specific operating limit has been verified.

---

## 4. Covenant & Condition Precedent Matrix
${checks.map((c) => `- **${c.test}**: ${c.result} (Observed: ${c.observed_dscr || c.observed_debt_share_pct + "%" || "N/A"}, Threshold: ${c.threshold})`).join("\n")}

### Outstanding Conditions Precedent:
${conditions.map((c, i) => `${i + 1}. ${c}`).join("\n")}

---

## 5. Audit & Claim Ledger
Input figures are caller-supplied and unverified. The 15-year tenor and 5.5% interest rate are illustrative assumptions; required CFADS is a calculated requirement, not a revenue forecast.

- **Workbook provenance**: No Excel workbook or PDF was generated; no file digest is available.
- **Sign-off Requirement**: Mandatory human credit analyst review before board presentation.
`;

  // 15-Year Deterministic Debt Service Waterfall
  const waterfall = [];
  let balance = ifiDebtUsdM;
  const annualPrincipal = Math.round((ifiDebtUsdM / 15) * 100) / 100;
  const interestRate = 0.055; // 5.5% indicative IFI margin + base rate

  for (let year = 1; year <= 15; year++) {
    const opening = Math.round(balance * 100) / 100;
    const principal = year === 15 ? opening : Math.min(opening, annualPrincipal);
    const interest = Math.round(opening * interestRate * 100) / 100;
    const debtService = Math.round((principal + interest) * 100) / 100;
    const closing = Math.round((opening - principal) * 100) / 100;
    const requiredCfads = Math.round(debtService * dscrMin * 100) / 100;
    balance = closing;

    waterfall.push({
      year,
      senior_debt_opening_usd_m: opening,
      principal_usd_m: principal,
      interest_usd_m: interest,
      total_debt_service_usd_m: debtService,
      senior_debt_closing_usd_m: closing,
      required_cfads_usd_m: requiredCfads,
      projected_dscr: dscrMin
    });
  }

  baseResponse.full_dossier = {
    status: "UNLOCKED",
    dossier_markdown: fullMemoMarkdown,
    financial_model_sha256: null,
    excel_financial_model_sha256: null,
    provenance_status: "no_workbook_generated",
    model_assumptions: { tenor_years: 15, interest_rate: 0.055, dscr: dscrMin, scope: "illustrative_scenario_not_forecast" },
    waterfall_schedule_15yr: waterfall,
    settlement_network: "base",
    settlement_currency: "USDC",
    unlocked_at: new Date().toISOString()
  };

  return baseResponse;
}

export function extractBankabilityParameters(input = {}, rawText = "") {
  let text = typeof rawText === "string" ? rawText : "";
  if (!text && typeof input.prompt === "string") text = input.prompt;
  if (!text && typeof input.query === "string") text = input.query;
  if (!text && typeof input.text === "string") text = input.text;
  if (!text && typeof input.message === "string") text = input.message;

  const result = {
    project_name: input.project_name,
    corridor_leg: input.corridor_leg,
    capex_usd_m: input.capex_usd_m,
    ifi_debt_usd_m: input.ifi_debt_usd_m,
    dscr_min: input.dscr_min,
    currency_mismatch: input.currency_mismatch !== undefined ? input.currency_mismatch : true,
    has_sovereign_guarantee: input.has_sovereign_guarantee,
    evidence_sources: input.evidence_sources,
    inferred_parameters: false
  };

  if (text) {
    const lower = text.toLowerCase();
    if (!result.corridor_leg) {
      if (lower.includes("aktau") && lower.includes("baku")) result.corridor_leg = "Aktau-Baku";
      else if (lower.includes("khorgos") || lower.includes("dostyk") || lower.includes("altynkol")) result.corridor_leg = "Khorgos-Aktau";
      else if (lower.includes("poti") && lower.includes("baku")) result.corridor_leg = "Baku-Poti";
      else if (lower.includes("constanta") || lower.includes("black sea")) result.corridor_leg = "Poti-Constanta";
      else if (lower.includes("caspian") || lower.includes("middle corridor") || lower.includes("titr")) result.corridor_leg = "Aktau-Baku";
    }

    if (result.capex_usd_m === undefined) {
      const capexMatch = text.match(/\$?\s*(\d+(?:\.\d+)?)\s*(?:m|million|млн)/i);
      if (capexMatch) {
        result.capex_usd_m = parseFloat(capexMatch[1]);
      }
    }

    if (!result.project_name) {
      if (lower.includes("terminal") || lower.includes("port")) {
        result.project_name = "Trans-Caspian Port Terminal Facility";
      } else if (lower.includes("rail") || lower.includes("railway")) {
        result.project_name = "Trans-Caspian Railway Corridor Expansion";
      } else if (lower.includes("vessel") || lower.includes("fleet") || lower.includes("ship")) {
        result.project_name = "Caspian Maritime Feeder Fleet Acquisition";
      }
    }
  }

  // Text hints may help identify the project, but cannot invent underwriting metrics.
  result.inferred_parameters = Boolean(text);
  return result;
}
