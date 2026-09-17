// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "forge-std/StdInvariant.sol";
import "../contracts/M2MEscrow.sol";
import "./MockUSDC.sol";

contract EscrowHandler is Test {
    M2MEscrow public escrowContract;
    MockUSDC public usdc;

    uint256 public totalActiveDeposits;
    uint256 internal arbiterPrivateKey;
    address public arbiterSigner;
    address public arbiterTreasury;

    address internal buyer = address(0xB0B);
    address internal seller = address(0x5E11);

    uint256 public escrowCounter;

    constructor(
        M2MEscrow _escrow,
        MockUSDC _usdc,
        uint256 _pk,
        address _treasury
    ) {
        escrowContract = _escrow;
        usdc = _usdc;
        arbiterPrivateKey = _pk;
        arbiterSigner = vm.addr(_pk);
        arbiterTreasury = _treasury;

        usdc.mint(buyer, 1_000_000_000 * 1e6);
        vm.prank(buyer);
        usdc.approve(address(escrowContract), type(uint256).max);
    }

    function createAndSettleFuzz(
        uint256 rawAmount,
        uint256 sellerPct, // 0 to 100
        uint256 feePct     // 0 to 5
    ) external {
        uint256 amount = bound(rawAmount, 100 * 1e6, 1_000_000 * 1e6);
        sellerPct = bound(sellerPct, 0, 95);
        feePct = bound(feePct, 0, 5);

        bytes32 escrowId = keccak256(abi.encodePacked("escrow", escrowCounter++));
        bytes32 artifactHash = keccak256(abi.encodePacked("artifact", escrowId));

        vm.prank(buyer);
        escrowContract.createEscrow(
            escrowId,
            seller,
            amount,
            block.timestamp + 1 days,
            artifactHash,
            M2MEscrow.ArbitrationPolicy.PRO_RATA
        );

        totalActiveDeposits += amount;

        // Seller delivers
        vm.prank(seller);
        escrowContract.submitDelivery(escrowId, artifactHash);

        // Compute split
        uint256 fee = (amount * feePct) / 100;
        uint256 sellerPayout = (amount * sellerPct) / 100;
        uint256 buyerRefund = amount - sellerPayout - fee;

        uint256 nonce = escrowCounter;
        bytes32 rulingHash = keccak256(
            abi.encodePacked(
                escrowId,
                uint8(M2MEscrow.Ruling.PARTIAL_SETTLEMENT),
                sellerPayout,
                buyerRefund,
                fee,
                nonce,
                block.chainid,
                address(escrowContract)
            )
        );
        bytes32 ethSignedHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", rulingHash)
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(arbiterPrivateKey, ethSignedHash);
        bytes memory sig = abi.encodePacked(r, s, v);

        escrowContract.settleDisputeWithArbiterRuling(
            escrowId,
            M2MEscrow.Ruling.PARTIAL_SETTLEMENT,
            sellerPayout,
            buyerRefund,
            fee,
            nonce,
            sig
        );

        totalActiveDeposits -= amount;
    }
}

contract M2MEscrowInvariantsTest is StdInvariant, Test {
    M2MEscrow public escrowContract;
    MockUSDC public usdc;
    EscrowHandler public handler;

    uint256 internal arbiterPrivateKey = 0xA11CE;
    address internal arbiterSigner;
    address internal arbiterTreasury = address(0x777);

    address internal buyer = address(0xB0B);
    address internal seller = address(0x5E11);

    function setUp() public {
        arbiterSigner = vm.addr(arbiterPrivateKey);
        usdc = new MockUSDC();
        escrowContract = new M2MEscrow(address(usdc), arbiterSigner, arbiterTreasury);

        handler = new EscrowHandler(escrowContract, usdc, arbiterPrivateKey, arbiterTreasury);
        targetContract(address(handler));
    }

    /**
     * @notice Invariant 1: Vault Solvency & Balance Conservation.
     * Contract USDC balance strictly equals total currently active, unsettled deposits.
     */
    function invariant_vaultBalanceConservation() public view {
        assertEq(
            usdc.balanceOf(address(escrowContract)),
            handler.totalActiveDeposits(),
            "Contract balance must strictly equal active deposits"
        );
    }

    /**
     * @notice Fuzz Test 1: Settlement Balance Conservation.
     * Proves that any valid partition of amount (seller + buyer + fee == amount) succeeds,
     * and any invalid partition reverts.
     */
    function testFuzz_settlementBalanceConservation(
        uint256 rawAmount,
        uint256 sellerPayout,
        uint256 arbiterFee
    ) public {
        uint256 amount = bound(rawAmount, 10 * 1e6, 1_000_000 * 1e6);
        sellerPayout = bound(sellerPayout, 0, amount);
        arbiterFee = bound(arbiterFee, 0, amount - sellerPayout);
        uint256 buyerRefund = amount - sellerPayout - arbiterFee;

        // Fund buyer
        usdc.mint(buyer, amount);
        vm.prank(buyer);
        usdc.approve(address(escrowContract), amount);

        bytes32 escrowId = keccak256(abi.encodePacked("fuzz-deal", amount, sellerPayout));
        bytes32 artifactHash = keccak256("artifact");

        vm.prank(buyer);
        escrowContract.createEscrow(
            escrowId,
            seller,
            amount,
            block.timestamp + 1 days,
            artifactHash,
            M2MEscrow.ArbitrationPolicy.PRO_RATA
        );

        bytes32 rulingHash = keccak256(
            abi.encodePacked(
                escrowId,
                uint8(M2MEscrow.Ruling.PARTIAL_SETTLEMENT),
                sellerPayout,
                buyerRefund,
                arbiterFee,
                uint256(1),
                block.chainid,
                address(escrowContract)
            )
        );
        bytes32 ethSignedHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", rulingHash)
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(arbiterPrivateKey, ethSignedHash);
        bytes memory sig = abi.encodePacked(r, s, v);

        escrowContract.settleDisputeWithArbiterRuling(
            escrowId,
            M2MEscrow.Ruling.PARTIAL_SETTLEMENT,
            sellerPayout,
            buyerRefund,
            arbiterFee,
            1,
            sig
        );

        // Contract balance must be 0 after settlement
        assertEq(usdc.balanceOf(address(escrowContract)), 0);
    }

    /**
     * @notice Fuzz Test 2: Unbalanced payouts strictly revert.
     */
    function testFuzz_unbalancedPayoutReverts(
        uint256 rawAmount,
        uint256 delta
    ) public {
        uint256 amount = bound(rawAmount, 100 * 1e6, 1_000_000 * 1e6);
        delta = bound(delta, 1, 100 * 1e6);

        usdc.mint(buyer, amount);
        vm.prank(buyer);
        usdc.approve(address(escrowContract), amount);

        bytes32 escrowId = keccak256(abi.encodePacked("fuzz-unbalanced", amount));
        bytes32 artifactHash = keccak256("artifact");

        vm.prank(buyer);
        escrowContract.createEscrow(
            escrowId,
            seller,
            amount,
            block.timestamp + 1 days,
            artifactHash,
            M2MEscrow.ArbitrationPolicy.PRO_RATA
        );

        // Imbalance: amount + delta
        vm.expectRevert("Payout sum must equal escrow amount");
        escrowContract.settleDisputeWithArbiterRuling(
            escrowId,
            M2MEscrow.Ruling.PARTIAL_SETTLEMENT,
            amount + delta,
            0,
            0,
            1,
            ""
        );
    }

    /**
     * @notice Fuzz Test 3: Unauthorized signatures strictly revert.
     */
    function testFuzz_unauthorizedSignerRejection(uint256 badKey) public {
        vm.assume(badKey > 0 && badKey < 115792089237316195423570985008687907852837564279074904382605163141518161494337);
        vm.assume(badKey != arbiterPrivateKey);

        uint256 amount = 100 * 1e6;
        usdc.mint(buyer, amount);
        vm.prank(buyer);
        usdc.approve(address(escrowContract), amount);

        bytes32 escrowId = keccak256(abi.encodePacked("fuzz-bad-signer", badKey));
        bytes32 artifactHash = keccak256("artifact");

        vm.prank(buyer);
        escrowContract.createEscrow(
            escrowId,
            seller,
            amount,
            block.timestamp + 1 days,
            artifactHash,
            M2MEscrow.ArbitrationPolicy.PRO_RATA
        );

        bytes32 rulingHash = keccak256(
            abi.encodePacked(
                escrowId,
                uint8(M2MEscrow.Ruling.RELEASE_TO_SELLER),
                amount,
                uint256(0),
                uint256(0),
                uint256(1),
                block.chainid,
                address(escrowContract)
            )
        );
        bytes32 ethSignedHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", rulingHash)
        );
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(badKey, ethSignedHash);
        bytes memory sig = abi.encodePacked(r, s, v);

        vm.expectRevert("Invalid arbiter signature");
        escrowContract.settleDisputeWithArbiterRuling(
            escrowId,
            M2MEscrow.Ruling.RELEASE_TO_SELLER,
            amount,
            0,
            0,
            1,
            sig
        );
    }
}
