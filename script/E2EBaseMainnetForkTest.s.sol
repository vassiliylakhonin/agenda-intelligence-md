// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "forge-std/Test.sol";
import "../contracts/M2MEscrow.sol";

interface IERC20Minimal {
    function balanceOf(address account) external view returns (uint256);
    function approve(address spender, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
}

/**
 * @title E2EBaseMainnetForkTest
 * @notice Live on-chain simulation running against Base Mainnet fork (Chain ID 8453).
 * Interacts directly with the official native Circle USDC contract: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913.
 * Tests contract deployment, escrow funding, partial delivery, dispute, and deterministic arbitration settlement.
 */
contract E2EBaseMainnetForkTest is Script {
    address public constant BASE_MAINNET_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    uint256 internal deployerKey = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80; // Anvil #0
    uint256 internal buyerKey    = 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d; // Anvil #1
    uint256 internal sellerKey   = 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a; // Anvil #2
    uint256 internal arbiterKey  = 0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6; // Anvil #3

    address internal deployer;
    address internal buyer;
    address internal seller;
    address internal arbiter;
    address internal treasury = address(0x5b5296A3a7bAc0F5F096F93b60C1c121f2e5c663); // Agenda Intelligence Treasury

    function run() external {
        deployer = vm.addr(deployerKey);
        buyer    = vm.addr(buyerKey);
        seller   = vm.addr(sellerKey);
        arbiter  = vm.addr(arbiterKey);

        console.log("======================================================================");
        console.log(" M2MEscrow Autonomous E2E On-Chain Test on BASE MAINNET Fork");
        console.log("======================================================================");
        console.log("Chain ID:            ", block.chainid);
        console.log("Deployer:            ", deployer);
        console.log("Buyer Agent:         ", buyer);
        console.log("Seller Agent:        ", seller);
        console.log("Arbiter Signer:      ", arbiter);
        console.log("Treasury:            ", treasury);
        console.log("Native Circle USDC:  ", BASE_MAINNET_USDC);

        // Step 1: Deploy M2MEscrow pointing to canonical Circle USDC
        vm.startBroadcast(deployerKey);
        M2MEscrow escrow = new M2MEscrow(BASE_MAINNET_USDC, arbiter, treasury);
        vm.stopBroadcast();

        IERC20Minimal usdc = IERC20Minimal(BASE_MAINNET_USDC);

        console.log("\n[Step 1] Contract Deployed on Base Mainnet Fork:");
        console.log("  M2MEscrow:         ", address(escrow));
        console.log("  Buyer USDC Balance:", usdc.balanceOf(buyer) / 1e6, "USDC");

        // Step 2: Buyer approves and creates Escrow Deal
        bytes32 escrowId = keccak256("base-mainnet-deal-caspian-metals-001");
        bytes32 expectedHash = keccak256("ulba-beryllium-certificate-spec-v1");
        uint256 dealAmount = 1_000 * 1e6; // 1,000 USDC
        uint256 deadline = block.timestamp + 3 days;

        vm.startBroadcast(buyerKey);
        usdc.approve(address(escrow), dealAmount);
        escrow.createEscrow(
            escrowId,
            seller,
            dealAmount,
            deadline,
            expectedHash,
            M2MEscrow.ArbitrationPolicy.PRO_RATA
        );
        vm.stopBroadcast();

        console.log("\n[Step 2] Escrow Deal Created on Base Mainnet:");
        console.log("  Deal Amount:       ", dealAmount / 1e6, "USDC");
        console.log("  Escrow Contract Bal:", usdc.balanceOf(address(escrow)) / 1e6, "USDC");

        // Step 3: Seller delivers partial milestone
        bytes32 actualHash = keccak256("ulba-beryllium-certificate-spec-partial-80pct");
        vm.startBroadcast(sellerKey);
        escrow.submitDelivery(escrowId, actualHash);
        vm.stopBroadcast();
        console.log("\n[Step 3] Seller Delivered Partial Milestone Artifact");

        // Step 4: Buyer raises dispute
        vm.startBroadcast(buyerKey);
        escrow.raiseDispute(escrowId, "Partial shipment delivered: 800/1000 kg verified");
        vm.stopBroadcast();
        console.log("\n[Step 4] Buyer Raised Dispute on Base Mainnet Contract");

        // Step 5: Arbiter signs deterministic ruling (80% partial settlement)
        uint256 sellerPayout = 792 * 1e6;
        uint256 buyerRefund  = 198 * 1e6;
        uint256 arbiterFee   = 10 * 1e6;
        uint256 nonce = 1;

        bytes32 rulingHash = keccak256(
            abi.encodePacked(
                escrowId,
                uint8(M2MEscrow.Ruling.PARTIAL_SETTLEMENT),
                sellerPayout,
                buyerRefund,
                arbiterFee,
                nonce,
                block.chainid,
                address(escrow)
            )
        );
        bytes32 ethSignedMessageHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", rulingHash)
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(arbiterKey, ethSignedMessageHash);
        bytes memory arbiterSig = abi.encodePacked(r, s, v);

        // Step 6: Settle dispute on-chain
        vm.startBroadcast(deployerKey);
        escrow.settleDisputeWithArbiterRuling(
            escrowId,
            M2MEscrow.Ruling.PARTIAL_SETTLEMENT,
            sellerPayout,
            buyerRefund,
            arbiterFee,
            nonce,
            arbiterSig
        );
        vm.stopBroadcast();

        console.log("\n[Step 5 & 6] Arbitrated Settlement Executed on Base Mainnet:");
        console.log("  Seller USDC Received:", usdc.balanceOf(seller) / 1e6, "USDC (expected: 792)");
        console.log("  Buyer USDC Refund:   ", (usdc.balanceOf(buyer) - (9_000 * 1e6)) / 1e6, "USDC (expected: 198)");
        console.log("  Treasury Fee:        ", usdc.balanceOf(treasury) / 1e6, "USDC (expected: 10)");
        console.log("  Escrow Contract Bal: ", usdc.balanceOf(address(escrow)) / 1e6, "USDC (expected: 0)");

        // Assertions for full conservation
        require(usdc.balanceOf(seller) == sellerPayout, "Seller payout mismatch");
        require(usdc.balanceOf(treasury) == arbiterFee, "Treasury fee mismatch");
        require(usdc.balanceOf(address(escrow)) == 0, "Escrow contract balance must be 0");
        console.log("\n>>> ALL INVARIANTS SATISFIED WITH CANONICAL CIRCLE USDC ON BASE MAINNET <<<");
    }
}
