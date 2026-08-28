# Agenda Intelligence MD — Unit Economics & Margins

*Detailed financial breakdown of compute, token costs, and gross margins across deployment tiers.*

---

## 1. Cost Architecture per Query

Unlike traditional GenAI wrappers that send large prompts to expensive frontier LLMs ($5–$30 / 1M tokens), Agenda Intelligence MD uses a **two-tier cascade**:

1. **Tier 1 — Deterministic Verification (95% of queries):**
   - Executed entirely in JavaScript / Python on serverless edge compute (Cloudflare Workers).
   - Validates JSON schemas, references, quote exactness, numeric values, and sentence-level polarity without calling an LLM.
   - **Cost per query:** **$0.0001** (Worker invocation cost only; **$0 token cost**).

2. **Tier 2 — Model Auto-Repair & Synthesis (5% of queries upon error):**
   - Triggered only when a packet fails verification and the caller requests an automated repair prompt.
   - Routes to efficient open-weights / lightweight models (DeepSeek V4 Flash @ $0.14/1M input, Gemini 3.6 Flash @ $1.50/1M input).
   - **Cost per repair generation:** **~$0.0008 – $0.002**.

---

## 2. Unit Economics Breakdown (Blended 10,000 Query Batch)

| Component | Cost per 10,000 Checks | Notes |
|---|---|---|
| Edge Compute (Cloudflare Workers) | $1.00 | $0.10 / 1M requests baseline |
| Tier 1 Deterministic Linters | $0.00 | Pure CPU / memory execution |
| Tier 2 LLM Auto-Repair (5% fail rate, 500 calls) | $0.75 | 500 calls × 1,000 tokens @ DeepSeek/Flash rate |
| Key-Value Storage & Telemetry (KV/D1) | $0.25 | Audit trail persistence |
| **Total Cost of Goods Sold (COGS)** | **$2.00** | **$0.00020 per query** |

---

## 3. Revenue & Gross Margin Model

### Pricing Tiers:
- **Developer / Pay-as-you-go:** $0.01 per verified check (~$100 per 10k checks).
- **Enterprise Volume Tier:** $0.005 per verified check (~$50 per 10k checks).
- **Enterprise Platform Subscription:** $2,500 – $10,000 / month (includes 500k – 2.5M monthly checks + dedicated private workers).

### Margins at Scale:

| Metric | Pay-as-you-go | Enterprise Volume | Enterprise Subscription |
|---|---|---|---|
| **Price per 10k checks** | $100.00 | $50.00 | ~$40.00 (implied) |
| **COGS per 10k checks** | $2.00 | $2.00 | $2.00 |
| **Gross Profit** | **$98.00** | **$48.00** | **$38.00** |
| **Gross Margin** | **98.0%** | **96.0%** | **95.0%** |

---

## 4. Human vs. Agent Cost Comparison

For an enterprise reviewing 50,000 counterparty transactions or legal claim packets per month:

- **Human Compliance Team:**
  - 10 analysts × $5,000/mo salary = **$50,000 / month**.
  - Turnaround time: 1–3 business days.
  - Error rate: 4–8% due to human fatigue.

- **Agenda Intelligence MD Fleet:**
  - 50,000 checks @ Enterprise rate = **$250 / month**.
  - Turnaround time: <500 milliseconds.
  - Error rate: 0% schema/polarity/quote bypass.

**Customer ROI: >99% direct cost savings with instant turnaround.**
