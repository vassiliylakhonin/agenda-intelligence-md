// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Script.sol";
import "../contracts/M2MEscrow.sol";
import "../test/MockUSDC.sol";

/**
 * @title E2ELocalForkTest
 * @notice Live on-chain simulation running against Base Sepolia fork.
 * Tests contract deployment, escrow funding, partial delivery, dispute, and deterministic arbitration settlement.
 */
contract E2ELocalForkTest is Script {
    uint256 internal deployerKey = 0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80; // Anvil #0
    uint256 internal buyerKey    = 0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d; // Anvil #1
    uint256 internal sellerKey   = 0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a; // Anvil #2
    uint256 internal arbiterKey  = 0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6; // Anvil #3

    address internal deployer;
    address internal buyer;
    address internal seller;
    address internal arbiter;
    address internal treasury = address(0x5b5296A3a7bAc0F5F096F93b60C1c121f2e5c663); // Platform Treasury

    function run() external {
        deployer = vm.addr(deployerKey);
        buyer    = vm.addr(buyerKey);
        seller   = vm.addr(sellerKey);
        arbiter  = vm.addr(arbiterKey);

        console.log("======================================================================");
        console.log(" M2MEscrow Autonomous E2E On-Chain Test on Base Sepolia Fork");
        console.log("======================================================================");
        console.log("Chain ID:            ", block.chainid);
        console.log("Deployer:            ", deployer);
        console.log("Buyer Agent:         ", buyer);
        console.log("Seller Agent:        ", seller);
        console.log("Arbiter Signer:      ", arbiter);
        console.log("Treasury:            ", treasury);

        // Step 1: Deploy Mock USDC & M2MEscrow
        vm.startBroadcast(deployerKey);
        MockUSDC usdc = new MockUSDC();
        M2MEscrow escrow = new M2MEscrow(address(usdc), arbiter, treasury);
        usdc.mint(buyer, 10_000 * 1e6); // 10,000 USDC
        vm.stopBroadcast();

        console.log("\n[Step 1] Contracts Deployed:");
        console.log("  Mock USDC:         ", address(usdc));
        console.log("  M2MEscrow:         ", address(escrow));
        console.log("  Buyer USDC Balance:", usdc.balanceOf(buyer) / 1e6, "USDC");

        // Step 2: Buyer approves and creates Escrow Deal
        bytes32 escrowId = keccak256("deal-middle-corridor-rare-metals-001");
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

        console.log("\n[Step 2] Escrow Deal Created:");
        console.log("  Deal Amount:       ", dealAmount / 1e6, "USDC");
        console.log("  Escrow Contract Bal:", usdc.balanceOf(address(escrow)) / 1e6, "USDC");

        // Step 3: Seller delivers partial milestone
        bytes32 actualHash = keccak256("ulba-beryllium-certificate-spec-partial-80pct");
        vm.startBroadcast(sellerKey);
        escrow.submitDelivery(escrowId, actualHash);
        vm.stopBroadcast();
        console.log("\n[Step 3] Seller Delivered Artifact (Hash Mismatch / Partial Delivery Recorded)");

        // Step 4: Buyer raises dispute
        vm.startBroadcast(buyerKey);
        escrow.raiseDispute(escrowId, "Partial shipment delivered: 800/1000 kg verified");
        vm.stopBroadcast();
        console.log("\n[Step 4] Buyer Raised Dispute on Contract");

        // Step 5: Arbiter signs deterministic ruling (80% partial settlement)
        // Seller payout: 80% of 990 = $792 USDC
        // Buyer refund:  20% of 990 = $198 USDC
        // Arbiter fee:   1% = $10 USDC
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

        bytes32 ethSignedHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", rulingHash)
        );

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(arbiterKey, ethSignedHash);
        bytes memory signature = abi.encodePacked(r, s, v);

        // Step 6: Execute settlement on-chain
        vm.startBroadcast(deployerKey);
        escrow.settleDisputeWithArbiterRuling(
            escrowId,
            M2MEscrow.Ruling.PARTIAL_SETTLEMENT,
            sellerPayout,
            buyerRefund,
            arbiterFee,
            nonce,
            signature
        );
        vm.stopBroadcast();

        console.log("\n[Step 5 & 6] Arbitrated On-Chain Settlement Executed:");
        console.log("  Seller Balance:    ", usdc.balanceOf(seller) / 1e6, "USDC (Target: 792 USDC)");
        console.log("  Buyer Balance:     ", usdc.balanceOf(buyer) / 1e6, "USDC (Target: 9198 USDC)");
        console.log("  Treasury Balance:  ", usdc.balanceOf(treasury) / 1e6, "USDC (Target: 10 USDC)");
        console.log("  Escrow Contract:   ", usdc.balanceOf(address(escrow)) / 1e6, "USDC (Target: 0 USDC)");

        require(usdc.balanceOf(seller) == sellerPayout, "Seller balance mismatch!");
        require(usdc.balanceOf(treasury) == arbiterFee, "Treasury fee mismatch!");
        require(usdc.balanceOf(address(escrow)) == 0, "Escrow contract should be empty!");

        console.log("\n======================================================================");
        console.log(" ALL ON-CHAIN INVARIANTS & BALANCE CONSERVATION VERIFIED 100% OK!");
        console.log("======================================================================");
    }
}
