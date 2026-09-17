#!/usr/bin/env bash
# ==============================================================================
# Agenda Intelligence: Autonomous On-Chain Base Mainnet Fork E2E Test
# Clones live Base Mainnet (Chain ID 8453) and official Circle USDC contract.
# Verifies zero-faucet deployment, escrow creation, and arbitrated settlement.
# ==============================================================================
set -euo pipefail

export PATH="$HOME/.foundry/bin:$PATH"

if ! command -v anvil >/dev/null 2>&1; then
    echo "[-] Error: 'anvil' not found. Install Foundry."
    exit 1
fi

FORK_URL="${BASE_MAINNET_RPC:-https://mainnet.base.org}"
PORT=8546
ANVIL_PID=""

cleanup() {
    if [ -n "$ANVIL_PID" ] && kill -0 "$ANVIL_PID" 2>/dev/null; then
        echo "[*] Shutting down local Anvil Base Mainnet fork (PID $ANVIL_PID)..."
        kill -9 "$ANVIL_PID" 2>/dev/null || true
    fi
}
trap cleanup EXIT INT TERM

echo "======================================================================"
echo " Agenda Intelligence • Starting Local BASE MAINNET Fork (Anvil)"
echo " Fork Upstream: $FORK_URL (Chain ID 8453)"
echo "======================================================================"

WHALE="0xd0b53D9277642d899DF5C87A3966A349A798F224"
BUYER="0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
USDC="0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"

# Start anvil fork in background on port 8546
anvil --fork-url "$FORK_URL" --chain-id 8453 --port "$PORT" --silent > /dev/null 2>&1 &
ANVIL_PID=$!
echo "[+] Anvil Base Mainnet fork running with PID $ANVIL_PID on port $PORT"

# Wait for RPC to respond
for i in {1..30}; do
    if cast block-number --rpc-url "http://127.0.0.1:$PORT" >/dev/null 2>&1; then
        BLOCK=$(cast block-number --rpc-url "http://127.0.0.1:$PORT")
        echo "[+] Local fork ready! Forked at Base Mainnet block #$BLOCK"
        break
    fi
    sleep 0.5
done

echo "[*] Seeding buyer account with 10,000 canonical Circle USDC from pool..."
# Impersonate whale on local anvil node
cast rpc anvil_impersonateAccount "$WHALE" --rpc-url "http://127.0.0.1:$PORT" > /dev/null
# Fund whale with ETH for gas on local fork
cast rpc anvil_setBalance "$WHALE" 0x1000000000000000000 --rpc-url "http://127.0.0.1:$PORT" > /dev/null
# Transfer 10,000 USDC (10,000,000,000 units) from whale to buyer on-chain
cast send "$USDC" "transfer(address,uint256)" "$BUYER" 10000000000 \
    --from "$WHALE" \
    --unlocked \
    --rpc-url "http://127.0.0.1:$PORT" > /dev/null

echo "[+] Buyer ($BUYER) funded with 10,000 USDC on-chain."

echo ""
echo "[*] Broadcasting M2MEscrow against canonical Circle USDC on Base Mainnet..."
echo "----------------------------------------------------------------------"

forge script script/E2EBaseMainnetForkTest.s.sol:E2EBaseMainnetForkTest \
    --rpc-url "http://127.0.0.1:$PORT" \
    --broadcast \
    -vvv

echo ""
echo "[✓] Full on-chain Base Mainnet dispute arbitration & balance conservation verified!"
