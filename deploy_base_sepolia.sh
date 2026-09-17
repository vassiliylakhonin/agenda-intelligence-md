#!/usr/bin/env bash
# ==============================================================================
# Agenda Intelligence: M2MEscrow Smart Contract Deployment to Base Sepolia
# ==============================================================================
set -euo pipefail

# Ensure foundry binaries are in PATH
export PATH="$HOME/.foundry/bin:$PATH"

if ! command -v forge >/dev/null 2>&1; then
    echo "[-] Error: 'forge' binary not found. Install Foundry via 'curl -L https://foundry.paradigm.xyz | bash && foundryup'"
    exit 1
fi

RPC_URL="${BASE_SEPOLIA_RPC:-https://sepolia.base.org}"
CHAIN_ID="84532"
USDC_SEPOLIA="0x036CbD53842c5426634e7929541eC2318f3dCF7e"
ARBITER_DEFAULT="0x5b5296A3a7bAc0F5F096F93b60C1c121f2e5c663"

export ARBITER_SIGNER="${ARBITER_SIGNER:-$ARBITER_DEFAULT}"
export ARBITER_TREASURY="${ARBITER_TREASURY:-$ARBITER_DEFAULT}"
export USDC_ADDRESS="${USDC_ADDRESS:-$USDC_SEPOLIA}"

echo "======================================================================"
echo " Agenda Intelligence • M2MEscrow Deployer (Base Sepolia Chain ID $CHAIN_ID)"
echo "======================================================================"
echo "RPC URL:           $RPC_URL"
echo "USDC Token:        $USDC_ADDRESS"
echo "Arbiter Signer:    $ARBITER_SIGNER"
echo "Arbiter Treasury:  $ARBITER_TREASURY"
echo "----------------------------------------------------------------------"

# Check private key
DEPLOYER_KEY="${ETH_PRIVATE_KEY:-${PRIVATE_KEY:-}}"

if [ -z "$DEPLOYER_KEY" ]; then
    echo "[!] No ETH_PRIVATE_KEY or PRIVATE_KEY found in environment."
    echo "[*] Running DRY-RUN simulation..."
    forge script script/DeployM2MEscrow.s.sol:DeployM2MEscrow --rpc-url "$RPC_URL" -vvv
    echo ""
    echo "----------------------------------------------------------------------"
    echo "[*] Simulation succeeded! To broadcast to live Base Sepolia:"
    echo "    ETH_PRIVATE_KEY=0x... ./deploy_base_sepolia.sh --broadcast"
    echo "----------------------------------------------------------------------"
    exit 0
fi

# Derive deployer address
DEPLOYER_ADDR=$(cast wallet address --private-key "$DEPLOYER_KEY")
echo "[+] Deployer Address: $DEPLOYER_ADDR"

# Check deployer ETH balance
BALANCE_WEI=$(cast balance "$DEPLOYER_ADDR" --rpc-url "$RPC_URL" 2>/dev/null || echo "0")
BALANCE_ETH=$(cast from-wei "$BALANCE_WEI" 2>/dev/null || echo "0")
echo "[+] Current Balance:  $BALANCE_ETH ETH"

MIN_REQUIRED_WEI=50000000000000 # 0.00005 ETH
if [ "$BALANCE_WEI" -lt "$MIN_REQUIRED_WEI" ]; then
    echo "[-] Error: Insufficient Base Sepolia ETH for gas."
    echo "    Required: ~0.00005 ETH | Available: $BALANCE_ETH ETH"
    echo "[!] Please request free testnet ETH from one of the following faucets:"
    echo "    - https://faucets.chain.link/base-sepolia"
    echo "    - https://www.alchemy.com/faucets/base-sepolia"
    echo "    - https://learnweb3.io/faucets/base_sepolia"
    echo "    Target Address: $DEPLOYER_ADDR"
    exit 1
fi

if [[ "${1:-}" == "--broadcast" ]]; then
    echo "[+] Broadcasting deployment to Base Sepolia..."
    export ETH_PRIVATE_KEY="$DEPLOYER_KEY"
    forge script script/DeployM2MEscrow.s.sol:DeployM2MEscrow \
        --rpc-url "$RPC_URL" \
        --broadcast \
        -vvvv
    echo ""
    echo "[✓] Deployment completed successfully!"
    echo "    View on BaseScan: https://sepolia.basescan.org/address/$DEPLOYER_ADDR"
else
    echo "[*] Key detected. Running simulation. Add '--broadcast' to execute on-chain:"
    echo "    ./deploy_base_sepolia.sh --broadcast"
    export ETH_PRIVATE_KEY="$DEPLOYER_KEY"
    forge script script/DeployM2MEscrow.s.sol:DeployM2MEscrow --rpc-url "$RPC_URL" -vvv
fi
