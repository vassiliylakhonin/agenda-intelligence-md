#!/usr/bin/env bash
# ==============================================================================
# Agenda Intelligence: Autonomous On-Chain Base Sepolia Fork E2E Test
# Runs without external faucets or tokens. Forks Base Sepolia state locally via Anvil.
# ==============================================================================
set -euo pipefail

export PATH="$HOME/.foundry/bin:$PATH"

if ! command -v anvil >/dev/null 2>&1; then
    echo "[-] Error: 'anvil' not found. Install Foundry."
    exit 1
fi

FORK_URL="${BASE_SEPOLIA_RPC:-https://sepolia.base.org}"
PORT=8545
ANVIL_PID=""

cleanup() {
    if [ -n "$ANVIL_PID" ] && kill -0 "$ANVIL_PID" 2>/dev/null; then
        echo "[*] Shutting down local Anvil fork (PID $ANVIL_PID)..."
        kill -9 "$ANVIL_PID" 2>/dev/null || true
    fi
}
trap cleanup EXIT INT TERM

echo "======================================================================"
echo " Agenda Intelligence • Starting Local Base Sepolia Fork (Anvil)"
echo " Fork Upstream: $FORK_URL"
echo "======================================================================"

# Start anvil fork in background
anvil --fork-url "$FORK_URL" --port "$PORT" --silent > /dev/null 2>&1 &
ANVIL_PID=$!
echo "[+] Anvil fork running with PID $ANVIL_PID on port $PORT"

# Wait for RPC to respond
for i in {1..30}; do
    if cast block-number --rpc-url "http://127.0.0.1:$PORT" >/dev/null 2>&1; then
        BLOCK=$(cast block-number --rpc-url "http://127.0.0.1:$PORT")
        echo "[+] Local fork ready! Forked at Base Sepolia block #$BLOCK"
        break
    fi
    sleep 0.5
done

echo ""
echo "[*] Broadcasting M2MEscrow contracts & executing full dispute cycle..."
echo "----------------------------------------------------------------------"

forge script script/E2ELocalForkTest.s.sol:E2ELocalForkTest \
    --rpc-url "http://127.0.0.1:$PORT" \
    --broadcast \
    -vvv

echo ""
echo "[✓] Full on-chain dispute arbitration & balance conservation verified!"
