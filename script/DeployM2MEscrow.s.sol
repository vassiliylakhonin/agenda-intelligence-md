// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/M2MEscrow.sol";

contract DeployM2MEscrow is Script {
    // Official Base Sepolia Circle USDC
    address public constant BASE_SEPOLIA_USDC = 0x036CbD53842c5426634e7929541eC2318f3dCF7e;
    // Official Base Mainnet Circle USDC
    address public constant BASE_MAINNET_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    function run() external returns (M2MEscrow escrow) {
        uint256 deployerPrivateKey = vm.envOr(
            "ETH_PRIVATE_KEY",
            uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80) // Anvil default #0
        );

        address arbiterSigner = vm.envOr(
            "ARBITER_SIGNER",
            address(0x70997970C51812dc3A010C7d01b50e0d17dc79C8) // Anvil default #1
        );

        address arbiterTreasury = vm.envOr(
            "ARBITER_TREASURY",
            address(0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC) // Anvil default #2
        );

        address usdcAddress;
        if (block.chainid == 8453) {
            usdcAddress = BASE_MAINNET_USDC;
        } else {
            usdcAddress = vm.envOr("USDC_ADDRESS", BASE_SEPOLIA_USDC);
        }

        vm.startBroadcast(deployerPrivateKey);
        escrow = new M2MEscrow(usdcAddress, arbiterSigner, arbiterTreasury);
        vm.stopBroadcast();

        console.log("M2MEscrow deployed to:", address(escrow));
        console.log("  USDC Token:        ", usdcAddress);
        console.log("  Arbiter Signer:    ", arbiterSigner);
        console.log("  Arbiter Treasury:  ", arbiterTreasury);
        console.log("  Chain ID:          ", block.chainid);
    }
}
