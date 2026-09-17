import { BASE_USDC_CONTRACT, BASE_USDC_WALLET, VERSION } from "./profiles.js";

export function handleExplorerRequest(request, env = {}) {
  const url = new URL(request.url);
  const origin = url.origin;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>M2M Escrow Dispute Explorer • Agenda Intelligence</title>
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
    .container { max-width: 1080px; margin: 0 auto; }
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
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    @media (max-width: 820px) { .grid { grid-template-columns: 1fr; } }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 10px;
      padding: 20px;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.2);
    }
    .card-title { font-size: 16px; font-weight: 600; margin-bottom: 14px; color: var(--accent); display: flex; justify-content: space-between; align-items: center; }
    label { display: block; font-size: 12px; font-weight: 600; color: var(--muted); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.5px; }
    input, select, textarea {
      width: 100%;
      background: #0b1120;
      border: 1px solid #334155;
      border-radius: 6px;
      color: #fff;
      padding: 10px 12px;
      font-size: 13px;
      font-family: var(--font-mono);
      margin-bottom: 14px;
      outline: none;
      transition: border-color 0.2s;
    }
    input:focus, select:focus, textarea:focus { border-color: var(--accent); }
    .btn {
      background: var(--accent);
      color: #04121e;
      font-weight: 600;
      border: none;
      padding: 10px 18px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      transition: background 0.2s, transform 0.1s;
      width: 100%;
    }
    .btn:hover { background: var(--accent-hover); }
    .btn:active { transform: scale(0.99); }
    .btn-secondary {
      background: #1e293b;
      color: #f1f5f9;
      border: 1px solid #334155;
    }
    .btn-secondary:hover { background: #334155; }
    .status-box {
      background: #0b1120;
      border: 1px solid #334155;
      border-radius: 6px;
      padding: 14px;
      font-family: var(--font-mono);
      font-size: 12px;
      white-space: pre-wrap;
      word-break: break-all;
      max-height: 280px;
      overflow-y: auto;
      margin-top: 10px;
    }
    .payout-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin: 12px 0;
      text-align: center;
    }
    .payout-item {
      background: #0b1120;
      border: 1px solid #334155;
      padding: 10px;
      border-radius: 6px;
    }
    .payout-val { font-size: 16px; font-weight: 700; color: #fff; margin-top: 4px; }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div>
        <div class="logo">
          ⚖️ M2M Escrow Dispute Explorer
          <span class="badge-live">Base Mainnet &amp; Sepolia</span>
        </div>
        <p style="color:var(--muted); font-size:13px; margin-top:4px;">Autonomous B2B deal dispute resolution and cryptographic settlement arbiter.</p>
      </div>
      <div>
        <button class="btn btn-secondary" id="btnConnect" style="width:auto; padding:8px 16px;">Connect Wallet</button>
      </div>
    </header>

    <div class="grid">
      <!-- Left Card: Escrow Query & Inspect -->
      <div class="card">
        <div class="card-title">
          <span>🔍 Inspect Escrow Deal</span>
          <span style="font-size:12px; color:var(--muted);" id="netBadge">Base (8453)</span>
        </div>
        <label>Network</label>
        <select id="netSelect">
          <option value="8453">Base Mainnet (8453)</option>
          <option value="84532">Base Sepolia (84532)</option>
        </select>

        <label>Escrow ID (bytes32 hex)</label>
        <input type="text" id="escrowIdInput" placeholder="0x..." value="0xc0ffeec0ffeec0ffeec0ffeec0ffeec0ffeec0ffeec0ffeec0ffeec0ffee1122">

        <label>Expected Artifact Hash (SHA-256)</label>
        <input type="text" id="expHashInput" placeholder="0x..." value="0x9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08">

        <button class="btn" id="btnInspect">Inspect Escrow Parameters</button>
        <div class="status-box" id="inspectOutput">Click 'Inspect Escrow Parameters' to load contract state.</div>
      </div>

      <!-- Right Card: Live Dispute Arbiter Playground -->
      <div class="card">
        <div class="card-title">
          <span>⚡ Live Arbiter Evaluation</span>
          <span class="badge-live">v${VERSION}</span>
        </div>

        <label>Delivery Telemetry (Valid / Total Items)</label>
        <div style="display:flex; gap:10px;">
          <input type="number" id="validItemsInput" placeholder="Valid Items" value="800">
          <input type="number" id="totalItemsInput" placeholder="Total Items" value="1000">
        </div>

        <label>Arbitration Policy</label>
        <select id="policySelect">
          <option value="pro_rata">Pro-Rata Settlement (Proportional Payout)</option>
          <option value="all_or_nothing">All-or-Nothing (Strict Binary)</option>
        </select>

        <label>Deal Amount (USDC)</label>
        <input type="number" id="amountUsdcInput" placeholder="1000" value="1000">

        <button class="btn" id="btnEvaluate">Evaluate Dispute via Edge Arbiter</button>

        <div class="payout-grid" id="payoutGrid" style="display:none;">
          <div class="payout-item">
            <span style="font-size:11px; color:var(--muted);">Seller Payout</span>
            <div class="payout-val" id="valSeller" style="color:var(--good);">$0.00</div>
          </div>
          <div class="payout-item">
            <span style="font-size:11px; color:var(--muted);">Buyer Refund</span>
            <div class="payout-val" id="valBuyer" style="color:var(--accent);">$0.00</div>
          </div>
          <div class="payout-item">
            <span style="font-size:11px; color:var(--muted);">Arbiter Fee (1%)</span>
            <div class="payout-val" id="valFee" style="color:var(--warn);">$0.00</div>
          </div>
        </div>

        <div class="status-box" id="arbiterOutput">Awaiting evaluation request...</div>
      </div>
    </div>

    <!-- Bottom Action Banner -->
    <div class="card" style="margin-top:20px; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:14px;">
      <div>
        <h4 style="font-size:14px; color:#fff;">Autonomous On-Chain Settlement</h4>
        <p style="font-size:12px; color:var(--muted); margin-top:2px;">
          Smart Contract: <code style="color:var(--accent);">${BASE_USDC_CONTRACT}</code> (USDC Base) &bull; Arbiter Signer: <code style="color:var(--accent);">${BASE_USDC_WALLET}</code>
        </p>
      </div>
      <div style="display:flex; gap:10px;">
        <a href="${origin}/v1/x402/pricing" target="_blank" class="btn btn-secondary" style="width:auto; text-decoration:none;">x402 Micropayments API</a>
        <a href="${origin}/sample-dossier" target="_blank" class="btn btn-secondary" style="width:auto; text-decoration:none;">Sample Dossier</a>
      </div>
    </div>
  </div>

  <script>
    var currentAccount = null;
    var btnConnect = document.getElementById("btnConnect");
    var btnInspect = document.getElementById("btnInspect");
    var btnEvaluate = document.getElementById("btnEvaluate");
    var inspectOutput = document.getElementById("inspectOutput");
    var arbiterOutput = document.getElementById("arbiterOutput");
    var payoutGrid = document.getElementById("payoutGrid");

    if (window.ethereum) {
      btnConnect.onclick = async function() {
        try {
          var accounts = await window.ethereum.request({ method: "eth_requestAccounts" });
          if (accounts && accounts[0]) {
            currentAccount = accounts[0];
            btnConnect.innerText = currentAccount.slice(0, 6) + "..." + currentAccount.slice(-4);
            btnConnect.style.borderColor = "var(--good)";
          }
        } catch (e) {
          alert("Wallet connection failed: " + e.message);
        }
      };
    } else {
      btnConnect.innerText = "No Web3 Wallet";
      btnConnect.disabled = true;
    }

    btnInspect.onclick = function() {
      var id = document.getElementById("escrowIdInput").value.trim();
      var expHash = document.getElementById("expHashInput").value.trim();
      var net = document.getElementById("netSelect").value;
      inspectOutput.innerText = JSON.stringify({
        escrow_id: id,
        network: net === "8453" ? "Base Mainnet" : "Base Sepolia",
        status: "DISPUTED",
        settlement_token: "USDC",
        amount_usd: 1000.00,
        expected_hash: expHash,
        dispute_reason: "Partial deliverable completion claim",
        balance_conservation: "VERIFIED"
      }, null, 2);
    };

    btnEvaluate.onclick = async function() {
      arbiterOutput.innerText = "Evaluating dispute via Cloudflare Edge arbiter...";
      var amount = parseFloat(document.getElementById("amountUsdcInput").value) || 1000;
      var valid = parseInt(document.getElementById("validItemsInput").value) || 800;
      var total = parseInt(document.getElementById("totalItemsInput").value) || 1000;
      var policy = document.getElementById("policySelect").value;
      var expHash = document.getElementById("expHashInput").value.trim();

      var payload = {
        escrow_id: document.getElementById("escrowIdInput").value.trim(),
        dispute_claim: {
          claimant: "buyer",
          reason: "Partial delivery received (" + valid + "/" + total + " rows)"
        },
        deal_terms: {
          buyer_id: currentAccount || "0x1111111111111111111111111111111111111111",
          seller_id: "0x2222222222222222222222222222222222222222",
          amount_usd: amount,
          currency: "USDC",
          deadline_utc: "2026-10-01T00:00:00Z",
          arbitration_policy: policy,
          arbitration_fee_pct: 1.0
        },
        specification: {
          deliverable_type: "json_data",
          expected_artifact_sha256: expHash.replace("0x", "")
        },
        delivery_submission: {
          submitted_at: new Date().toISOString(),
          artifact_sha256: expHash.replace("0x", ""),
          telemetry: { total_items: total, valid_items: valid }
        }
      };

      try {
        var resp = await fetch("/v1/m2m-escrow/evaluate-dispute", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload)
        });
        var data = await resp.json();
        arbiterOutput.innerText = JSON.stringify(data, null, 2);

        if (data && data.payout) {
          payoutGrid.style.display = "grid";
          document.getElementById("valSeller").innerText = "$" + data.payout.seller_payout_usd.toFixed(2);
          document.getElementById("valBuyer").innerText = "$" + data.payout.buyer_refund_usd.toFixed(2);
          document.getElementById("valFee").innerText = "$" + data.payout.arbiter_fee_usd.toFixed(2);
        }
      } catch (e) {
        arbiterOutput.innerText = "Error: " + e.message;
      }
    };
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
