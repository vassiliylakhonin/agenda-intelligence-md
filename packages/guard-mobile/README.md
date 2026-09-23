# @agenda-intelligence/guard-mobile

> **The ultra-lightweight, zero-dependency Mobile & Edge Security SDK for AI Agents.**  
> Pre-sign financial transaction firewall, prompt injection shield, and M2M escrow arbiter for on-device and mobile agents (Muse, Instinct, ElizaOS, AgentKit, React Native, iOS, Android).

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-brightgreen.svg)]()
[![Edge Latency](https://img.shields.io/badge/Edge%20Latency-%3C20ms-success.svg)]()

---

## 🌟 Why Mobile & On-Device Agents Need This

With models running directly on smartphones (Apple Silicon, Snapdragon, Meta Muse, Llama-3B), agents face an **Excessive Agency Dilemma**:
1. **Prompt Injections**: A malicious website or tweet can trick a local LLM into calling `transfer()` and draining the wallet.
2. **Infinite Token Approvals**: Drainers lure agents into signing `approve(max_uint256)`.
3. **AML & Sanctions Compliance**: Local devices cannot store gigabytes of constantly shifting OFAC/SDN blacklists.

`@agenda-intelligence/guard-mobile` acts as an **independent pre-sign security firewall**:
- Evaluates transactions on **Cloudflare Edge across 330+ Anycast cities in <20ms**.
- **Offline Fallback**: Automatically falls back to built-in local heuristics if in airplane mode.
- **Zero-Retention**: Operates purely in ephemeral RAM; no user prompts or private keys are stored.
- **x402 Native**: Supports automatic autonomous micropayments in Base USDC ($0.05/check).

---

## 📦 Installation

```bash
npm install @agenda-intelligence/guard-mobile
```

*Works out of the box in React Native, Expo, Node.js 18+, Bun, Deno, and standard browsers.*

---

## 🚀 Quickstart: React Native & TypeScript

```typescript
import { AgentFinancialGuardClient } from "@agenda-intelligence/guard-mobile";

const guard = new AgentFinancialGuardClient();

// 1. Check transaction before signing with your mobile wallet
const result = await guard.check({
  recipient: "0xd90e2f925da726b50c4ed8d0fb90ad053324f31b", // e.g. Tornado Cash
  amount_usd: 50.0,
  token: "USDC",
  network: "base_mainnet",
  intent_prompt: "User asked to swap 50 USDC for data access"
});

if (!result.isSafe) {
  console.warn("Transaction Blocked!", result.advisory);
  console.warn("Violations:", result.violations);
  // Abort wallet signature!
  return;
}

// 2. Safe to proceed with wallet.signTransaction()!
```

---

## ⚡ 1-Line Convenience Check

```typescript
if (!(await guard.isSafe({ recipient, amount_usd, intent_prompt }))) {
  throw new Error("Security guardrail failed. Aborting transaction.");
}
```

---

## 🤝 M2M Escrow Arbitration for Agent Deals

When agents buy data or services from other agents, settle disputes deterministically:

```typescript
import { M2MEscrowClient } from "@agenda-intelligence/guard-mobile";

const escrow = new M2MEscrowClient();

const ruling = await escrow.evaluateDispute({
  escrow_id: "deal_12345",
  deal_terms: {
    buyer_id: "0xBuyer...",
    seller_id: "0xSeller...",
    amount_usd: 500.0,
    currency: "USDC",
    deadline_utc: "2026-10-01T00:00:00Z",
    arbitration_policy: "pro_rata",
    arbitration_fee_pct: 1.0
  },
  specification: {
    deliverable_type: "json_dataset",
    expected_artifact_sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
  },
  delivery_submission: {
    submitted_at: "2026-09-22T10:00:00Z",
    artifact_sha256: "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
  }
});

console.log("Ruling:", ruling.ruling); // "RELEASE_TO_SELLER"
console.log("Seller Payout:", ruling.payout_breakdown.seller_payout_usd); // 495.0
console.log("Arbiter Fee:", ruling.payout_breakdown.arbiter_fee_usd); // 5.0
```

---

## 🍎 Native iOS (Swift) Integration

If you are developing a native iOS agent (e.g. for Apple Intelligence or Muse Glimmer wrapper):

```swift
import Foundation

struct GuardRequest: Codable {
    let run_id: String
    let transaction: TxData
    let intent: IntentData
}

struct TxData: Codable {
    let network: String
    let token: String
    let amount_usd: Double
    let recipient: String
}

struct IntentData: Codable {
    let prompt: String
}

func checkTransaction(recipient: String, amountUsd: Double, prompt: String, completion: @escaping (Bool, String) -> Void) {
    let url = URL(string: "https://agent-financial-guard-a2a.vassiliy-lakhonin.workers.dev/v1/agent-financial/pre-sign-check")!
    var request = URLRequest(url: url)
    request.httpMethod = "POST"
    request.setValue("application/json", forHTTPHeaderField: "Content-Type")
    
    let payload = GuardRequest(
        run_id: UUID().uuidString,
        transaction: TxData(network: "base_mainnet", token: "USDC", amount_usd: amountUsd, recipient: recipient),
        intent: IntentData(prompt: prompt)
    )
    request.httpBody = try? JSONEncoder().encode(payload)
    
    URLSession.shared.dataTask(with: request) { data, _, _ in
        guard let data = data,
              let json = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
              let verdict = json["financial_guard_verdict"] as? [String: Any],
              let decision = verdict["decision"] as? String else {
            completion(false, "Network error")
            return
        }
        completion(decision == "allow", verdict["execution_advisory"] as? String ?? "")
    }.resume()
}
```

---

## 🤖 Native Android (Kotlin) Integration

```kotlin
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject

fun checkTransactionSafety(recipient: String, amountUsd: Double, prompt: String, onResult: (Boolean, String) -> Unit) {
    val client = OkHttpClient()
    val json = JSONObject().apply {
        put("run_id", "run_" + System.currentTimeMillis())
        put("transaction", JSONObject().apply {
            put("network", "base_mainnet")
            put("token", "USDC")
            put("amount_usd", amountUsd)
            put("recipient", recipient)
        })
        put("intent", JSONObject().apply {
            put("prompt", prompt)
        })
    }

    val request = Request.Builder()
        .url("https://agent-financial-guard-a2a.vassiliy-lakhonin.workers.dev/v1/agent-financial/pre-sign-check")
        .post(json.toString().toRequestBody("application/json".toMediaType()))
        .build()

    client.newCall(request).enqueue(object : Callback {
        override fun onFailure(call: Call, e: java.io.IOException) = onResult(false, e.message ?: "Failed")
        override fun onResponse(call: Call, response: Response) {
            val body = response.body?.string() ?: ""
            val verdict = JSONObject(body).optJSONObject("financial_guard_verdict")
            val decision = verdict?.optString("decision") ?: "reject"
            val advisory = verdict?.optString("execution_advisory") ?: ""
            onResult(decision == "allow", advisory)
        }
    })
}
```

---

## 📄 License
MIT © [Vassiliy Lakhonin](https://github.com/vassiliylakhonin)
