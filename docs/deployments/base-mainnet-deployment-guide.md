# Base Mainnet Smart Contract Deployment Guide: M2MEscrow

This runbook describes the production deployment, verification, and zero-faucet fork simulation for the **M2MEscrow** autonomous settlement contract on **Base Mainnet (Chain ID 8453)**.

---

## 1. Core Parameters & Addresses

| Entity | Address | Description |
| :--- | :--- | :--- |
| **Network** | Base Mainnet | Chain ID: `8453` |
| **RPC Endpoint** | `https://mainnet.base.org` | Official Base Mainnet RPC |
| **Block Explorer** | `https://basescan.org` | Basescan (Etherscan family) |
| **USDC Token** | `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913` | Native Circle USDC on Base (6 decimals) |
| **Arbiter Signer** | `0x5b5296A3a7bAc0F5F096F93b60C1c121f2e5c663` | Agenda Intelligence Arbiter Quorum |
| **Platform Treasury** | `0x5b5296A3a7bAc0F5F096F93b60C1c121f2e5c663` | Protocol arbitration fee recipient (1%) |

---

## 2. Autonomous Fork E2E Test (Zero-Faucet & Zero-Cost)

Before executing live mainnet transactions, verify the entire on-chain contract lifecycle against an Anvil clone of Base Mainnet state with real Circle USDC:

```bash
bash scripts/run_base_mainnet_fork_e2e.sh
```

### Verified Steps in Simulation:
1. Forks live Base Mainnet at current block height.
2. Seeds buyer agent with 10,000 real Circle USDC from Uniswap V3 liquidity.
3. Deploys `M2MEscrow` referencing the canonical USDC contract (`0x8335...`).
4. Creates a 1,000 USDC escrow deal with SHA-256 deliverable commitment.
5. Simulates milestone delivery and buyer dispute.
6. Generates and verifies an ECDSA-signed arbitration ruling with replay protection.
7. Executes deterministic settlement: 792 USDC to seller, 198 USDC refund to buyer, 10 USDC protocol fee, and 0 USDC remaining in vault.

---

## 3. Production Deployment to Base Mainnet

### Prerequisites:
1. A deployer wallet on Base Mainnet funded with at least **0.0005 ETH** (~$1.25 USD, actual deployment gas is ~0.000030 ETH).
2. A Basescan API key (optional for automatic contract source code verification).

### Step 3.1: Dry-Run Simulation (Recommended)
Simulate deployment against live RPC without spending gas:
```bash
forge script script/DeployM2MEscrow.s.sol:DeployM2MEscrow \
  --rpc-url https://mainnet.base.org \
  -vvv
```

### Step 3.2: Live On-Chain Broadcast
Execute deployment using your private key:
```bash
export ETH_PRIVATE_KEY="0x..." # Your deployer private key
export ETHERSCAN_API_KEY="your_basescan_api_key"

forge script script/DeployM2MEscrow.s.sol:DeployM2MEscrow \
  --rpc-url https://mainnet.base.org \
  --broadcast \
  --verify \
  --verifier-url https://api.basescan.org/api \
  -vvvv
```

---

## 4. Manual Verification on Basescan (If Required)

If source verification was not completed during broadcast, verify directly:

```bash
forge verify-contract <DEPLOYED_CONTRACT_ADDRESS> \
  contracts/M2MEscrow.sol:M2MEscrow \
  --chain-id 8453 \
  --verifier-url https://api.basescan.org/api \
  --etherscan-api-key $ETHERSCAN_API_KEY \
  --constructor-args 0x000000000000000000000000833589fcd6edb6e08f4c7c32d4f71b54bda029130000000000000000000000005b5296a3a7bac0f5f096f93b60c1c121f2e5c6630000000000000000000000005b5296a3a7bac0f5f096f93b60c1c121f2e5c663
```

### Constructor Arguments ABI Encoding:
```
0x000000000000000000000000833589fcd6edb6e08f4c7c32d4f71b54bda029130000000000000000000000005b5296a3a7bac0f5f096f93b60c1c121f2e5c6630000000000000000000000005b5296a3a7bac0f5f096f93b60c1c121f2e5c663
```

---

## 5. Security & Invariant Guarantees
* **Strict Balance Conservation**: `sellerPayout + buyerRefund + arbiterFee == deal.amount`.
* **Replay Immunity**: Hash includes `escrowId`, `ruling`, payouts, `nonce`, `block.chainid`, and `address(this)`.
* **Zero-Retention Compliance**: No deal terms or signatures stored off-chain; edge arbiter processes in volatile RAM.
