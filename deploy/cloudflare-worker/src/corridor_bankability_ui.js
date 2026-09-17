import { BASE_USDC_CONTRACT, BASE_USDC_WALLET, VERSION } from "./profiles.js";

export function handleBankabilityUiRequest(request, env = {}) {
  const url = new URL(request.url);
  const origin = url.origin;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Trans-Caspian Corridor Bankability Screener • Agenda Intelligence</title>
  <style>
    :root {
      --bg: #090d16;
      --card-bg: #111827;
      --card-border: #1e293b;
      --text: #f1f5f9;
      --muted: #94a3b8;
      --accent: #38bdf8;
      --accent-hover: #0ea5e9;
      --good: #10b981;
      --bad: #ef4444;
      --warn: #f59e0b;
      --purple: #818cf8;
      --font-mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      padding: 24px 16px;
      line-height: 1.5;
    }
    .container { max-width: 1180px; margin: 0 auto; }
    header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 24px;
      border-bottom: 1px solid var(--card-border);
      margin-bottom: 24px;
      flex-wrap: wrap;
      gap: 12px;
    }
    .logo { font-size: 20px; font-weight: 700; color: #fff; display: flex; align-items: center; gap: 8px; }
    .badge-live {
      background: rgba(16, 185, 129, 0.15);
      color: var(--good);
      border: 1px solid rgba(16, 185, 129, 0.3);
      padding: 3px 8px;
      border-radius: 9999px;
      font-size: 12px;
      font-family: var(--font-mono);
    }
    .grid { display: grid; grid-template-columns: 440px 1fr; gap: 24px; }
    @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 10px;
      padding: 20px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2);
    }
    .card-title {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 14px;
      color: var(--accent);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    label {
      display: block;
      font-size: 11px;
      font-weight: 600;
      color: var(--muted);
      margin-bottom: 5px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    input, select, textarea {
      width: 100%;
      background: #0b1120;
      border: 1px solid #334155;
      border-radius: 6px;
      color: #fff;
      padding: 9px 12px;
      font-size: 13px;
      font-family: var(--font-mono);
      margin-bottom: 12px;
      outline: none;
      transition: border-color 0.2s;
    }
    input:focus, select:focus, textarea:focus { border-color: var(--accent); }
    .row { display: flex; gap: 10px; }
    .row > div { flex: 1; }
    .checkbox-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
      cursor: pointer;
    }
    .checkbox-row input {
      width: auto;
      margin-bottom: 0;
      cursor: pointer;
    }
    .checkbox-row span {
      font-size: 13px;
      color: var(--text);
    }
    .btn {
      background: var(--accent);
      color: #04121e;
      font-weight: 600;
      border: none;
      padding: 11px 18px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      transition: background 0.2s, transform 0.1s;
      width: 100%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    .btn:hover { background: var(--accent-hover); }
    .btn:active { transform: scale(0.99); }
    .btn-secondary {
      background: #1e293b;
      color: #f1f5f9;
      border: 1px solid #334155;
    }
    .btn-secondary:hover { background: #334155; }
    .btn-pay {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: #fff;
      box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
      font-size: 15px;
      padding: 13px 20px;
    }
    .btn-pay:hover {
      background: linear-gradient(135deg, #059669 0%, #047857 100%);
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
      margin-bottom: 16px;
    }
    .kpi-item {
      background: #0b1120;
      border: 1px solid #334155;
      padding: 12px;
      border-radius: 8px;
      text-align: center;
    }
    .kpi-label { font-size: 11px; color: var(--muted); text-transform: uppercase; }
    .kpi-val { font-size: 18px; font-weight: 700; color: #fff; margin-top: 4px; font-family: var(--font-mono); }
    .notice-box {
      background: #0b1120;
      border-left: 4px solid var(--warn);
      padding: 12px;
      border-radius: 0 6px 6px 0;
      font-size: 12px;
      color: #cbd5e1;
      margin-bottom: 14px;
    }
    .notice-box strong { color: var(--warn); }
    .unlock-banner {
      background: linear-gradient(180deg, rgba(30, 41, 59, 0.7) 0%, rgba(15, 23, 42, 0.9) 100%);
      border: 1px solid #3b82f6;
      border-radius: 8px;
      padding: 18px;
      margin-top: 16px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
      font-family: var(--font-mono);
      margin-top: 10px;
    }
    th, td {
      padding: 8px 10px;
      text-align: right;
      border-bottom: 1px solid #1e293b;
    }
    th:first-child, td:first-child { text-align: left; }
    th { color: var(--muted); font-weight: 600; background: #0b1120; }
    tr:hover { background: rgba(255, 255, 255, 0.02); }
    .memo-container {
      background: #0b1120;
      border: 1px solid #334155;
      border-radius: 6px;
      padding: 16px;
      font-size: 13px;
      line-height: 1.6;
      max-height: 400px;
      overflow-y: auto;
      white-space: pre-wrap;
      font-family: var(--font-mono);
      margin-top: 14px;
    }
    .zero-retention {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      color: var(--muted);
      margin-top: 12px;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div>
        <div class="logo">
          🚂 Trans-Caspian Corridor Bankability Screener
          <span class="badge-live">Base Mainnet (8453)</span>
        </div>
        <p style="color:var(--muted); font-size:13px; margin-top:4px;">
          Deterministic project finance covenants, Caspian hydrology bottleneck triage, and IFI memorandum generator.
        </p>
      </div>
      <div style="display:flex; gap:10px; align-items:center;">
        <button class="btn btn-secondary" id="btnConnect" style="width:auto; padding:8px 16px;">Connect Brave Wallet</button>
      </div>
    </header>

    <div class="grid">
      <!-- Left: Input Form -->
      <div class="card">
        <div class="card-title">
          <span>📝 Project Parameters</span>
          <span style="font-size:12px; color:var(--muted);">Freemium Teaser</span>
        </div>

        <label>Project Title</label>
        <input type="text" id="projectName" value="Aktau Port Dry Bulk Expansion Phase II">

        <label>Corridor Segment / Node</label>
        <select id="corridorLeg">
          <option value="Aktau-Baku" selected>Aktau-Baku (Caspian Maritime Feeder &amp; Port)</option>
          <option value="Khorgos-Aktau">Khorgos-Aktau (Kazakhstan Rail Spine &amp; Gauge Interchange)</option>
          <option value="Baku-Poti">Baku-Poti (Trans-Caucasus &amp; BTK Single-Track)</option>
          <option value="Poti-Constanta">Poti-Constanta (Black Sea Maritime Feeder)</option>
          <option value="MULTI_LEG">MULTI_LEG (Trans-Caspian Multimodal End-to-End)</option>
        </select>

        <div class="row">
          <div>
            <label>Total CapEx ($M USD)</label>
            <input type="number" id="capexUsdM" value="45.0" step="0.5" min="1">
          </div>
          <div>
            <label>Senior IFI Debt ($M USD)</label>
            <input type="number" id="ifiDebtUsdM" value="31.5" step="0.5" min="1">
          </div>
        </div>

        <div class="row">
          <div>
            <label>Projected Min DSCR</label>
            <input type="number" id="dscrMin" value="1.30" step="0.01" min="0.5">
          </div>
          <div>
            <label>Interest Margin (%)</label>
            <input type="number" id="marginPct" value="5.5" step="0.1" min="1">
          </div>
        </div>

        <label class="checkbox-row">
          <input type="checkbox" id="currencyMismatch" checked>
          <span>FX Mismatch (Local tariff revenue vs USD/EUR debt)</span>
        </label>

        <label class="checkbox-row">
          <input type="checkbox" id="sovereignGuarantee">
          <span>Asserted Sovereign Guarantee (Decree / MoF Backing)</span>
        </label>

        <button class="btn" id="btnScreen">⚡ Screen Corridor Bankability</button>

        <div class="zero-retention">
          🔒 Zero-Retention Guarantee: All evaluations run in RAM on Cloudflare Edge; no deal data is saved to disk or KV.
        </div>
      </div>

      <!-- Right: Evaluation Results & x402 Payment Unlock -->
      <div class="card">
        <div class="card-title">
          <span>📊 IFI Bankability Evaluation</span>
          <span id="tierBadge" class="badge-live" style="background:rgba(56,189,248,0.15); color:var(--accent); border-color:rgba(56,189,248,0.3);">
            Free Teaser
          </span>
        </div>

        <!-- KPI Grid -->
        <div class="kpi-grid">
          <div class="kpi-item">
            <div class="kpi-label">Verdict</div>
            <div class="kpi-val" id="kpiVerdict" style="color:var(--good); font-size:14px; margin-top:8px;">READY</div>
          </div>
          <div class="kpi-item">
            <div class="kpi-label">DSCR vs 1.20x Floor</div>
            <div class="kpi-val" id="kpiDscr">1.30x</div>
          </div>
          <div class="kpi-item">
            <div class="kpi-label">Senior Leverage</div>
            <div class="kpi-val" id="kpiLeverage">70.0%</div>
          </div>
        </div>

        <!-- Bottlenecks & Hydrology Warning -->
        <div class="notice-box" id="bottleneckNotice">
          <strong>Hydrological &amp; Chokepoint Sensitivity:</strong>
          <span id="bottleneckText">Click 'Screen Corridor Bankability' to evaluate against Trans-Caspian physical bottlenecks.</span>
        </div>

        <!-- Covenant Matrix Table -->
        <div style="font-size:12px; font-weight:600; color:var(--muted); text-transform:uppercase; margin-bottom:6px;">
          Credit Committee Covenant Checks:
        </div>
        <table id="covenantTable">
          <thead>
            <tr>
              <th>Covenant Test</th>
              <th>Threshold</th>
              <th>Observed</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody id="covenantRows">
            <tr>
              <td>Minimum DSCR Floor</td>
              <td>1.20x</td>
              <td>1.30x</td>
              <td style="color:var(--good);">PASSES</td>
            </tr>
            <tr>
              <td>Non-Sovereign Margin</td>
              <td>1.30x</td>
              <td>1.30x</td>
              <td style="color:var(--good);">PASSES</td>
            </tr>
            <tr>
              <td>Maximum Leverage</td>
              <td>&le; 80%</td>
              <td>70.0%</td>
              <td style="color:var(--good);">PASSES</td>
            </tr>
          </tbody>
        </table>

        <!-- Paid Tier Unlock Section -->
        <div class="unlock-banner" id="unlockBanner">
          <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:12px;">
            <div>
              <h4 style="font-size:15px; color:#fff; font-weight:700;">🚀 Unlock Full IFI Investment Dossier</h4>
              <p style="font-size:12px; color:var(--muted); margin-top:2px;">
                Includes complete 15-Year Debt Waterfall schedule, EBRD/ADB investment memorandum, and Excel financial model SHA-256 hash.
              </p>
            </div>
            <div style="text-align:right;">
              <span style="font-size:22px; font-weight:800; color:#fff; font-family:var(--font-mono);">$25</span>
              <span style="font-size:12px; color:var(--accent);">USDC (Base)</span>
            </div>
          </div>

          <button class="btn btn-pay" id="btnPayUnlock">
            <span>🦊 Pay $25 USDC with Brave Wallet on Base</span>
          </button>
          <div id="payStatus" style="font-size:12px; color:var(--muted); margin-top:8px; text-align:center; font-family:var(--font-mono);">
            Direct settlement to: <span style="color:var(--accent);">${BASE_USDC_WALLET.slice(0, 10)}...${BASE_USDC_WALLET.slice(-6)}</span>
          </div>
        </div>

        <!-- Unlocked Full Dossier View (Hidden until paid) -->
        <div id="unlockedView" style="display:none; margin-top:20px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
            <div style="font-size:14px; font-weight:700; color:var(--good);">
              ✅ 15-Year Deterministic Debt Service Waterfall
            </div>
            <div style="display:flex; gap:8px;">
              <button class="btn btn-secondary" id="btnDownloadMd" style="width:auto; padding:6px 12px; font-size:12px;">Download Memo (.md)</button>
              <button class="btn btn-secondary" id="btnDownloadJson" style="width:auto; padding:6px 12px; font-size:12px;">Download Waterfall (.json)</button>
            </div>
          </div>

          <div style="max-height:240px; overflow-y:auto; border:1px solid #334155; border-radius:6px;">
            <table>
              <thead>
                <tr>
                  <th>Yr</th>
                  <th>Opening Debt</th>
                  <th>Principal</th>
                  <th>Interest</th>
                  <th>Total Service</th>
                  <th>Closing Debt</th>
                  <th>Req. CFADS</th>
                  <th>DSCR</th>
                </tr>
              </thead>
              <tbody id="waterfallRows"></tbody>
            </table>
          </div>

          <div style="font-size:13px; font-weight:600; color:var(--accent); margin-top:16px;">
            📄 EBRD / ADB Investment Memorandum
          </div>
          <div class="memo-container" id="memoText"></div>
        </div>

      </div>
    </div>

    <!-- Bottom Footer -->
    <div class="card" style="margin-top:24px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px;">
      <div style="font-size:12px; color:var(--muted);">
        Smart Contract: <code style="color:var(--accent);">${BASE_USDC_CONTRACT}</code> &bull; Version: <code style="color:var(--accent);">v${VERSION}</code>
      </div>
      <div style="display:flex; gap:10px;">
        <a href="${origin}/explorer" target="_blank" class="btn btn-secondary" style="width:auto; text-decoration:none; padding:6px 14px; font-size:12px;">M2M Escrow Explorer</a>
        <a href="${origin}/sample-dossier" target="_blank" class="btn btn-secondary" style="width:auto; text-decoration:none; padding:6px 14px; font-size:12px;">Sample Deal Dossier</a>
        <a href="${origin}/llms.txt" target="_blank" class="btn btn-secondary" style="width:auto; text-decoration:none; padding:6px 14px; font-size:12px;">llms.txt</a>
      </div>
    </div>
  </div>

  <script>
    var BASE_USDC = "${BASE_USDC_CONTRACT}";
    var RECIPIENT = "${BASE_USDC_WALLET}";
    var currentAccount = null;
    var cachedUnlockedDossier = null;

    var btnConnect = document.getElementById("btnConnect");
    var btnScreen = document.getElementById("btnScreen");
    var btnPayUnlock = document.getElementById("btnPayUnlock");
    var payStatus = document.getElementById("payStatus");
    var unlockedView = document.getElementById("unlockedView");
    var unlockBanner = document.getElementById("unlockBanner");
    var tierBadge = document.getElementById("tierBadge");

    // Wallet Connection (Brave Wallet / MetaMask)
    if (window.ethereum) {
      btnConnect.onclick = async function() {
        try {
          var accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
          if (accounts && accounts[0]) {
            currentAccount = accounts[0];
            btnConnect.innerText = currentAccount.slice(0, 6) + "..." + currentAccount.slice(-4);
            btnConnect.style.borderColor = "var(--good)";
            await ensureBaseNetwork();
          }
        } catch (e) {
          alert("Wallet connection failed: " + e.message);
        }
      };
    } else {
      btnConnect.innerText = "No Web3 Wallet";
      btnConnect.disabled = true;
    }

    async function ensureBaseNetwork() {
      if (!window.ethereum) return;
      try {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x2105" }] // 8453 Base
        });
      } catch (switchError) {
        if (switchError.code === 4902) {
          try {
            await window.ethereum.request({
              method: "wallet_addEthereumChain",
              params: [{
                chainId: "0x2105",
                chainName: "Base",
                nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
                rpcUrls: ["https://mainnet.base.org"],
                blockExplorerUrls: ["https://basescan.org"]
              }]
            });
          } catch (addError) {
            console.error("Failed to add Base network:", addError);
          }
        }
      }
    }

    function getFormPayload() {
      return {
        project_name: document.getElementById("projectName").value.trim(),
        corridor_leg: document.getElementById("corridorLeg").value,
        capex_usd_m: parseFloat(document.getElementById("capexUsdM").value) || 45.0,
        ifi_debt_usd_m: parseFloat(document.getElementById("ifiDebtUsdM").value) || 31.5,
        dscr_min: parseFloat(document.getElementById("dscrMin").value) || 1.30,
        currency_mismatch: document.getElementById("currencyMismatch").checked,
        has_sovereign_guarantee: document.getElementById("sovereignGuarantee").checked
      };
    }

    // Run Free Screen
    btnScreen.onclick = async function() {
      var payload = getFormPayload();
      btnScreen.innerText = "Simulating Covenants...";
      try {
        var resp = await fetch("/v1/corridor-bankability/screen", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload)
        });
        var data = await resp.json();
        renderTeaser(data);
      } catch (e) {
        alert("Screening failed: " + e.message);
      } finally {
        btnScreen.innerText = "⚡ Screen Corridor Bankability";
      }
    };

    function renderTeaser(data) {
      document.getElementById("kpiVerdict").innerText = data.bankability_status || "UNKNOWN";
      if (data.bankability_status === "BANKABLE_CORE") {
        document.getElementById("kpiVerdict").style.color = "var(--good)";
      } else if (data.bankability_status === "CONDITIONALLY_BANKABLE") {
        document.getElementById("kpiVerdict").style.color = "var(--warn)";
      } else {
        document.getElementById("kpiVerdict").style.color = "var(--bad)";
      }

      document.getElementById("kpiDscr").innerText = (data.financial_metrics.dscr_minimum || 0).toFixed(2) + "x";
      document.getElementById("kpiLeverage").innerText = (data.financial_metrics.debt_share_pct || 0).toFixed(1) + "%";

      if (data.corridor_bottleneck_analysis) {
        document.getElementById("bottleneckText").innerText = data.corridor_bottleneck_analysis.bottleneck_description;
      }

      var covenantRows = document.getElementById("covenantRows");
      covenantRows.innerHTML = "";
      (data.covenant_checks || []).forEach(function(c) {
        var tr = document.createElement("tr");
        var resColor = c.result === "PASSES" ? "var(--good)" : (c.result === "FAILS" ? "var(--bad)" : "var(--warn)");
        var observed = c.observed_dscr ? c.observed_dscr.toFixed(2) + "x" : (c.observed_debt_share_pct ? c.observed_debt_share_pct + "%" : "N/A");
        tr.innerHTML = "<td>" + c.test.replace(/_/g, " ") + "</td><td>" + c.threshold + "</td><td>" + observed + "</td><td style='color:" + resColor + "; font-weight:700;'>" + c.result + "</td>";
        covenantRows.appendChild(tr);
      });
    }

    // Pay $25 USDC with Brave Wallet on Base
    btnPayUnlock.onclick = async function() {
      if (!window.ethereum) {
        alert("Please use Brave Browser with Brave Wallet or install MetaMask.");
        return;
      }

      try {
        if (!currentAccount) {
          var accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
          if (!accounts || !accounts[0]) throw new Error("No account selected.");
          currentAccount = accounts[0];
          btnConnect.innerText = currentAccount.slice(0, 6) + "..." + currentAccount.slice(-4);
        }

        await ensureBaseNetwork();

        payStatus.innerHTML = "⏳ Please confirm transfer of <strong>25 USDC</strong> in your Brave Wallet...";
        btnPayUnlock.disabled = true;

        // ERC-20 transfer(address to, uint256 amount)
        // transfer selector: 0xa9059cbb
        var cleanTo = RECIPIENT.toLowerCase().replace("0x", "");
        var paddedTo = cleanTo.padStart(64, "0");
        // 25.000000 USDC = 25,000,000 = 0x017d7840
        var amountRawHex = (25000000).toString(16).padStart(64, "0");
        var txData = "0xa9059cbb" + paddedTo + amountRawHex;

        var txHash = await window.ethereum.request({
          method: "eth_sendTransaction",
          params: [{
            from: currentAccount,
            to: BASE_USDC,
            data: txData
          }]
        });

        payStatus.innerHTML = "🔗 Transaction broadcast: <code style='color:var(--accent);'>" + txHash.slice(0, 10) + "..." + txHash.slice(-8) + "</code>. Verifying with Cloudflare Edge...";

        // Now call the endpoint with x-payment-tx header
        var payload = getFormPayload();
        var resp = await fetch("/v1/corridor-bankability/screen", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            "x-payment-tx": txHash
          },
          body: JSON.stringify(payload)
        });

        var data = await resp.json();

        if (data.unlocked_full_dossier && data.full_dossier) {
          cachedUnlockedDossier = data;
          unlockBanner.style.display = "none";
          tierBadge.innerText = "Unlocked ($25 USDC)";
          tierBadge.style.background = "rgba(16, 185, 129, 0.2)";
          tierBadge.style.color = "var(--good)";
          tierBadge.style.borderColor = "var(--good)";

          unlockedView.style.display = "block";
          renderFullDossier(data.full_dossier);
          alert("🎉 Bankability Dossier successfully unlocked via Base USDC!");
        } else {
          payStatus.innerHTML = "⚠️ Settlement pending verification. Tx: " + txHash;
        }

      } catch (err) {
        payStatus.innerHTML = "❌ Payment failed or rejected: " + err.message;
      } finally {
        btnPayUnlock.disabled = false;
      }
    };

    function renderFullDossier(dossier) {
      document.getElementById("memoText").innerText = dossier.dossier_markdown || "";

      var wfRows = document.getElementById("waterfallRows");
      wfRows.innerHTML = "";
      (dossier.waterfall_schedule_15yr || []).forEach(function(row) {
        var tr = document.createElement("tr");
        tr.innerHTML = "<td>" + row.year + "</td>" +
          "<td>$" + row.senior_debt_opening_usd_m.toFixed(2) + "M</td>" +
          "<td style='color:var(--good);'>$" + row.principal_usd_m.toFixed(2) + "M</td>" +
          "<td style='color:var(--warn);'>$" + row.interest_usd_m.toFixed(2) + "M</td>" +
          "<td style='font-weight:700;'>$" + row.total_debt_service_usd_m.toFixed(2) + "M</td>" +
          "<td>$" + row.senior_debt_closing_usd_m.toFixed(2) + "M</td>" +
          "<td>$" + row.required_cfads_usd_m.toFixed(2) + "M</td>" +
          "<td style='color:var(--accent); font-weight:700;'>" + row.projected_dscr.toFixed(2) + "x</td>";
        wfRows.appendChild(tr);
      });
    }

    document.getElementById("btnDownloadMd").onclick = function() {
      if (!cachedUnlockedDossier || !cachedUnlockedDossier.full_dossier) return;
      var text = cachedUnlockedDossier.full_dossier.dossier_markdown;
      var blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "IFI-Bankability-Memorandum.md";
      a.click();
    };

    document.getElementById("btnDownloadJson").onclick = function() {
      if (!cachedUnlockedDossier || !cachedUnlockedDossier.full_dossier) return;
      var text = JSON.stringify(cachedUnlockedDossier.full_dossier.waterfall_schedule_15yr, null, 2);
      var blob = new Blob([text], { type: "application/json;charset=utf-8" });
      var a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "15yr-Debt-Waterfall.json";
      a.click();
    };

    // Initial render on load
    btnScreen.click();
  </script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "public, max-age=300"
    }
  });
}
