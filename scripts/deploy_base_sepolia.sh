#!/usr/bin/env bash
set -euo pipefail

echo "=== M2MEscrow Base Sepolia Deployment Tool ==="
echo "Target Network: Base Sepolia (Chain ID 84532)"
echo "Target RPC:     https://sepolia.base.org"
echo "USDC Token:     0x036CbD53842c5426634e7929541eC2318f3dCF7e (Base Sepolia Native Circle USDC)"

if [ -z "${ETH_PRIVATE_KEY:-}" ]; then
  echo "Error: ETH_PRIVATE_KEY environment variable is not set."
  echo "Usage:"
  echo "  ETH_PRIVATE_KEY=0x... ARBITER_SIGNER=0x... ARBITER_TREASURY=0x... ./scripts/deploy_base_sepolia.sh"
  exit 1
fi

FORGE_BIN="${HOME}/.foundry/bin/forge"
if [ ! -x "${FORGE_BIN}" ]; then
  FORGE_BIN="$(command -v forge)"
fi

echo "Broadcasting deployment transaction to Base Sepolia..."
${FORGE_BIN} script script/DeployM2MEscrow.s.sol:DeployM2MEscrow \
  --rpc-url https://sepolia.base.org \
  --broadcast \
  ${ETHERSCAN_API_KEY:+--verify --etherscan-api-key "${ETHERSCAN_API_KEY}"} \
  -vvvv

echo "Deployment finished successfully!"
