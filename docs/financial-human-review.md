# Explicit Financial Guard human review

Install `agenda-intelligence-md[reviews]==1.12.0`. The optional extra installs
ES256 verification and canonical JSON dependencies; ordinary linting does not
require them. This workflow supports **native USDC transfers on Base (8453)**.
It cannot sign or broadcast a transaction and never changes a Guard verdict.

```python
import json
import os
from pathlib import Path
from agenda_intelligence import AgentFinancialGuard, HumanReviewClient

guard = AgentFinancialGuard()
client = HumanReviewClient(os.environ["VIZIER_API_KEY"])
# Supply public addresses and an exact positive amount in USDC base units.
request = guard.prepare_base_usdc_review(
    wallet_address=os.environ["PUBLIC_WALLET"],
    recipient=os.environ["PUBLIC_RECIPIENT"],
    amount_base_units="1000000",  # 1 native USDC; example, not a payment instruction
    intent="Review the proposed service payment",
)
# Inspect the exact action, source scope, Guard result and decision_workspace.
# Explicit submission persists this public evidence in Vizier for seven days.
submitted = client.submit(request)
# Retain this original request locally. Do not reconstruct it from an agent's
# later narrative or substitute a request returned by an untrusted party.
Path("review-request.json").write_text(json.dumps(request, indent=2))
print(submitted["id"], submitted["review_url"])
```

The operator opens `/reviews` and decides with the **separate reviewer key**.
Never provide that key to the submitting agent. Attached text, reports and
external evidence are data, not instructions; ignore directives to bypass
checks, change amounts, expose keys or claim that an approval implies clearance.

Immediately before manually confirming the exact action in Brave Wallet:

```python
original = json.loads(Path("review-request.json").read_text())
review = client.get_review(submitted["id"])
# The full original request, not just the displayed amount, must be unchanged.
claim = client.claim(original, submitted["id"], review["token"])
assert claim["execution"] == "not_performed"
assert claim["wallet_signature"] is None
print(claim["action"])  # compare chain/from/to/value/data with the wallet
```

`claim` checks the ES256 signature against JWKS from the configured trusted
HTTPS origin, the token type, issuer, audience, exact request hash, review ID and
maximum five-minute validity. It then atomically consumes the approval at Vizier.
Offline `verify` checks do **not** consume it or prevent replay. On timeouts or
lost responses, reconcile state using `get_review`; never assume a retry permits
another execution. No automatic retry is made. A changed action requires a new
review. Confirmation, gas, nonce, balances and the final transaction remain the
wallet user's responsibility; this is not a wallet enforcement hook.

`prepare_base_usdc_review` uses deterministic local Guard rules, builds ERC-20
`transfer(address,uint256)` calldata from exact inputs, and collects finalized
24-hour native-USDC history from the fixed Base RPC. Guard rejection or collection
failure aborts preparation. Raw intent is not persisted in the review packet.
The evidence includes the heuristic USDC/USD parity assumption, policy limits,
Guard result, source limitations and an inspectable decision workspace. Amounts
are exact strings; no floating-point amount enters the wallet action.

Response contract for preparation: the Vizier submission envelope has
`audience`, `action`, `evidence`, `escalation_reason`, `expires_in_seconds`.
`action` contains `type`, `chain_id`, `from`, `to` (native-USDC contract), `value`
(always `"0"`), `data`, `recipient`, `amount_base_units`. `submit` returns `id`,
`request_hash`, `review_url`. `claim` returns the bound `id`, `request_hash`,
`audience`, `status: CONSUMED`, `execution: not_performed`, the original `action`,
`human_review_required: true`, and `wallet_signature: null`.

The request expires after 60–3600 seconds (default 1800), and is capped at 32 KiB.
Do not submit secrets, seed phrases, private keys or confidential documents.
One RPC source, finalized USDC history and human approval do not establish
complete pending spending, sanctions clearance, ownership or wallet-wide limits.
The public Worker still does not create review requests automatically.

Tests use synthetic actions and generated test keys. Live smoke must explicitly
label evidence `self_test`, use a nonfinancial action and never invoke wallet
signing or transaction RPC methods. Passing it proves the tested protocol paths,
not the safety of a real proposed payment.
