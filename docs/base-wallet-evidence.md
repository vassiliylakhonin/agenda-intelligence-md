# Read-only Base wallet evidence

`AgentFinancialGuard.collect_base_usdc_history(wallet_address)` collects outgoing native-USDC Transfer events directly from `https://mainnet.base.org`. It does not accept a caller-supplied spending total and does not change a Financial Guard decision. This method is available from source after the change; it is not part of the already published 1.11.1 artifacts.

```python
from agenda_intelligence import AgentFinancialGuard
from agenda_intelligence.base_wallet_evidence import EvidenceUnavailable

try:
    evidence = AgentFinancialGuard().collect_base_usdc_history(
        "0x1111111111111111111111111111111111111111"  # replace with your public Base address
    )
except EvidenceUnavailable:
    # Missing evidence must not become zero spending or a signing permission.
    evidence = None
```

## Decision workspace

- Goal: obtain inspectable source-backed evidence for a human reviewing a proposed payment.
- Trusted evidence: responses from the fixed official Base RPC, chain ID 8453, pinned finalized block hash and exact native-USDC event fields.
- Unverified evidence: RPC completeness is provider-reported; caller ownership, sanctions status, other assets and pending spending remain unverified.
- Assumptions: the provider reports complete filtered logs and honors finalized block semantics.
- Next action: display or retain the evidence alongside the proposed transaction for review; never turn this result into wallet authorization.
- Stop/escalate: wrong chain, stale anchor, incomplete range, malformed/duplicate log, changed anchor, timeout, response-size or call-budget violation.

## Response contract (`schema_version: "1.0"`)

| Field | Meaning |
|---|---|
| `wallet`, `chain_id`, `source` | Normalized public address, 8453, official fixed RPC URL |
| `token_contract`, `asset`, `decimals` | Native USDC contract, asset label, 6 decimals |
| `observed_at` | Collection completion timestamp |
| `window_start_timestamp`, `window_end_timestamp` | Inclusive finalized 24-hour window in Unix seconds |
| `start_block`, `end_block`, `end_block_hash` | Exact query coverage and the checked finalized anchor |
| `unfinalized_gap_seconds` | Gap between collection start and the finalized window end |
| `successful_chunks` | Number of contiguous RPC log ranges read successfully |
| `source_reported_complete_for_scope` | True only after all ranges and anchor checks succeed; not independent verification |
| `outgoing_transfers` | Transaction hash, log index, block and string `amount_base_units` per event |
| `total_outgoing_base_units` | Exact integer sum as a string; not a floating-point USD amount |
| `authorization` | Always `not_authorized` |
| `limitations` | Provider trust, asset/window scope and missing authorization evidence |

Errors raise `EvidenceUnavailable` without returning a total. Up to 128 read-only RPC calls and 180 seconds are allowed; each response is capped at 4 MiB. Logs are fetched in ranges below 2,000 blocks. A finalized anchor older than one hour is rejected. The helper contains no signing or broadcast methods and requires no wallet/private key.

The window ends at finalization, not at the present instant. It excludes pending/unfinalized activity, other tokens, native ETH, approvals, offchain transactions and reservations for concurrent payments. It is therefore insufficient for wallet-wide rolling velocity enforcement. No live sanctions clearance or price assumption is introduced.

Sources: [Base network details](https://docs.base.org/get-started/connect-to-base) and [Base eth_getLogs semantics and range guidance](https://docs.base.org/base-chain/api-reference/ethereum-json-rpc-api/eth_getLogs).
