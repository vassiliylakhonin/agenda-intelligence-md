// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "forge-std/Test.sol";
import "../contracts/M2MEscrow.sol";
import "./MockUSDC.sol";

contract M2MEscrowTest is Test {
    M2MEscrow public escrowContract;
    MockUSDC public usdc;

    uint256 internal arbiterPrivateKey = 0xA11CE;
    address internal arbiterSigner;
    address internal arbiterTreasury = address(0x777);

    address internal buyer = address(0xB0B);
    address internal seller = address(0x5E11);

    bytes32 internal escrowId = keccak256("escrow-deal-001");
    bytes32 internal expectedHash = keccak256("expected-report-dataset");
    bytes32 internal actualHash = keccak256("expected-report-dataset");

    function setUp() public {
        arbiterSigner = vm.addr(arbiterPrivateKey);

        usdc = new MockUSDC();
        escrowContract = new M2MEscrow(address(usdc), arbiterSigner, arbiterTreasury);

        // Fund buyer with 10,000 USDC (6 decimals)
        usdc.mint(buyer, 10_000 * 1e6);
        vm.prank(buyer);
        usdc.approve(address(escrowContract), type(uint256).max);
    }

    function testCreateEscrow() public {
        vm.prank(buyer);
        escrowContract.createEscrow(
            escrowId,
            seller,
            1_000 * 1e6,
            block.timestamp + 1 days,
            expectedHash,
            M2MEscrow.ArbitrationPolicy.PRO_RATA
        );

        (
            bytes32 id,
            address b,
            address s,
            uint256 amt,
            uint256 deadline,
            bytes32 expH,
            bytes32 actH,
            M2MEscrow.ArbitrationPolicy pol,
            M2MEscrow.EscrowStatus status,
            ,
        ) = escrowContract.escrows(escrowId);

        assertEq(id, escrowId);
        assertEq(b, buyer);
        assertEq(s, seller);
        assertEq(amt, 1_000 * 1e6);
        assertEq(deadline, block.timestamp + 1 days);
        assertEq(expH, expectedHash);
        assertEq(actH, bytes32(0));
        assertEq(uint(pol), uint(M2MEscrow.ArbitrationPolicy.PRO_RATA));
        assertEq(uint(status), uint(M2MEscrow.EscrowStatus.CREATED));
        assertEq(usdc.balanceOf(address(escrowContract)), 1_000 * 1e6);
    }

    function testSubmitDeliveryClean() public {
        vm.prank(buyer);
        escrowContract.createEscrow(
            escrowId,
            seller,
            500 * 1e6,
            block.timestamp + 1 days,
            expectedHash,
            M2MEscrow.ArbitrationPolicy.PRO_RATA
        );

        vm.prank(seller);
        escrowContract.submitDelivery(escrowId, actualHash);

        (, , , , , , bytes32 actH, , M2MEscrow.EscrowStatus status, , uint256 deliveredAt) = escrowContract.escrows(escrowId);
        assertEq(actH, actualHash);
        assertEq(uint(status), uint(M2MEscrow.EscrowStatus.DELIVERED));
        assertGt(deliveredAt, 0);
    }

    function testReleaseClean() public {
        vm.prank(buyer);
        escrowContract.createEscrow(
            escrowId,
            seller,
            500 * 1e6,
            block.timestamp + 1 days,
            expectedHash,
            M2MEscrow.ArbitrationPolicy.PRO_RATA
        );

        vm.prank(seller);
        escrowContract.submitDelivery(escrowId, actualHash);

        vm.prank(buyer);
        escrowContract.releaseClean(escrowId);

        assertEq(usdc.balanceOf(seller), 500 * 1e6);
        assertEq(usdc.balanceOf(address(escrowContract)), 0);
    }

    function testClaimExpiredRefund() public {
        uint256 deadline = block.timestamp + 1 days;
        vm.prank(buyer);
        escrowContract.createEscrow(
            escrowId,
            seller,
            500 * 1e6,
            deadline,
            expectedHash,
            M2MEscrow.ArbitrationPolicy.PRO_RATA
        );

        // Warp time past deadline
        vm.warp(deadline + 1 hours);

        vm.prank(buyer);
        escrowContract.claimExpiredRefund(escrowId);

        assertEq(usdc.balanceOf(buyer), 10_000 * 1e6);
        assertEq(usdc.balanceOf(address(escrowContract)), 0);
    }

    function testRaiseDispute() public {
        vm.prank(buyer);
        escrowContract.createEscrow(
            escrowId,
            seller,
            500 * 1e6,
            block.timestamp + 1 days,
            expectedHash,
            M2MEscrow.ArbitrationPolicy.PRO_RATA
        );

        vm.prank(buyer);
        escrowContract.raiseDispute(escrowId, "Data quality insufficient");

        (, , , , , , , , M2MEscrow.EscrowStatus status, , ) = escrowContract.escrows(escrowId);
        assertEq(uint(status), uint(M2MEscrow.EscrowStatus.DISPUTED));
    }

    function testSettleWithArbiterRuling_Release() public {
        uint256 amount = 1_000 * 1e6;
        vm.prank(buyer);
        escrowContract.createEscrow(
            escrowId,
            seller,
            amount,
            block.timestamp + 1 days,
            expectedHash,
            M2MEscrow.ArbitrationPolicy.PRO_RATA
        );

        vm.prank(seller);
        escrowContract.submitDelivery(escrowId, actualHash);

        // Arbiter ruling: Full release with 1% arbiter fee ($990 to seller, $10 fee)
        uint256 sellerPayout = 990 * 1e6;
        uint256 buyerRefund = 0;
        uint256 arbiterFee = 10 * 1e6;
        uint256 nonce = 1;
        M2MEscrow.Ruling ruling = M2MEscrow.Ruling.RELEASE_TO_SELLER;

        bytes32 rulingHash = keccak256(
            abi.encodePacked(
                escrowId,
                uint8(ruling),
                sellerPayout,
                buyerRefund,
                arbiterFee,
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

        // Relayer submits settlement
        escrowContract.settleDisputeWithArbiterRuling(
            escrowId,
            ruling,
            sellerPayout,
            buyerRefund,
            arbiterFee,
            nonce,
            sig
        );

        assertEq(usdc.balanceOf(seller), sellerPayout);
        assertEq(usdc.balanceOf(arbiterTreasury), arbiterFee);
        assertEq(usdc.balanceOf(address(escrowContract)), 0);
    }

    function testSettleWithArbiterRuling_PartialSplit() public {
        uint256 amount = 1_000 * 1e6;
        vm.prank(buyer);
        escrowContract.createEscrow(
            escrowId,
            seller,
            amount,
            block.timestamp + 1 days,
            expectedHash,
            M2MEscrow.ArbitrationPolicy.PRO_RATA
        );

        // 75% partial fulfillment: $742.50 seller, $247.50 buyer refund, $10 fee
        uint256 sellerPayout = 742_500_000;
        uint256 buyerRefund = 247_500_000;
        uint256 arbiterFee = 10_000_000;
        uint256 nonce = 42;
        M2MEscrow.Ruling ruling = M2MEscrow.Ruling.PARTIAL_SETTLEMENT;

        bytes32 rulingHash = keccak256(
            abi.encodePacked(
                escrowId,
                uint8(ruling),
                sellerPayout,
                buyerRefund,
                arbiterFee,
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
            ruling,
            sellerPayout,
            buyerRefund,
            arbiterFee,
            nonce,
            sig
        );

        assertEq(usdc.balanceOf(seller), sellerPayout);
        assertEq(usdc.balanceOf(buyer), 9_000 * 1e6 + buyerRefund);
        assertEq(usdc.balanceOf(arbiterTreasury), arbiterFee);
        assertEq(usdc.balanceOf(address(escrowContract)), 0);
    }

    function testRevert_InvalidSignature() public {
        uint256 amount = 500 * 1e6;
        vm.prank(buyer);
        escrowContract.createEscrow(
            escrowId,
            seller,
            amount,
            block.timestamp + 1 days,
            expectedHash,
            M2MEscrow.ArbitrationPolicy.PRO_RATA
        );

        uint256 badPrivateKey = 0xDEAD;
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
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(badPrivateKey, ethSignedHash);
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

    function testRevert_ReplayAttack() public {
        uint256 amount = 500 * 1e6;
        vm.prank(buyer);
        escrowContract.createEscrow(
            escrowId,
            seller,
            amount,
            block.timestamp + 1 days,
            expectedHash,
            M2MEscrow.ArbitrationPolicy.PRO_RATA
        );

        uint256 nonce = 99;
        bytes32 rulingHash = keccak256(
            abi.encodePacked(
                escrowId,
                uint8(M2MEscrow.Ruling.RELEASE_TO_SELLER),
                amount,
                uint256(0),
                uint256(0),
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
            M2MEscrow.Ruling.RELEASE_TO_SELLER,
            amount,
            0,
            0,
            nonce,
            sig
        );

        // Second attempt with same rulingHash must revert
        vm.expectRevert("Escrow already closed");
        escrowContract.settleDisputeWithArbiterRuling(
            escrowId,
            M2MEscrow.Ruling.RELEASE_TO_SELLER,
            amount,
            0,
            0,
            nonce,
            sig
        );
    }

    function testRevert_BalanceConservationViolation() public {
        uint256 amount = 1_000 * 1e6;
        vm.prank(buyer);
        escrowContract.createEscrow(
            escrowId,
            seller,
            amount,
            block.timestamp + 1 days,
            expectedHash,
            M2MEscrow.ArbitrationPolicy.PRO_RATA
        );

        // Sum = 900 + 50 + 10 = 960 != 1000
        vm.expectRevert("Payout sum must equal escrow amount");
        escrowContract.settleDisputeWithArbiterRuling(
            escrowId,
            M2MEscrow.Ruling.PARTIAL_SETTLEMENT,
            900 * 1e6,
            50 * 1e6,
            10 * 1e6,
            1,
            ""
        );
    }
}
