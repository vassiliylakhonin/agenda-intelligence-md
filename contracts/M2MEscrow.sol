// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @dev Minimal ERC-20 interface for USDC settlements on Base (Chain ID 8453).
 */
interface IERC20 {
    function transfer(address to, uint256 value) external returns (bool);
    function transferFrom(address from, address to, uint256 value) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title M2MEscrow
 * @notice Autonomous B2B Escrow Contract for Agent-to-Agent (M2M) Commerce.
 * Operates on Base Mainnet (Chain ID 8453) using USDC.
 * Settlement disputes are resolved via cryptographically signed rulings from m2m-escrow-arbiter.
 */
contract M2MEscrow {
    enum EscrowStatus {
        CREATED,
        DELIVERED,
        DISPUTED,
        SETTLED,
        REFUNDED
    }

    enum Ruling {
        RELEASE_TO_SELLER,
        REFUND_TO_BUYER,
        PARTIAL_SETTLEMENT
    }

    enum ArbitrationPolicy {
        PRO_RATA,
        ALL_OR_NOTHING
    }

    struct EscrowDeal {
        bytes32 escrowId;
        address buyer;
        address seller;
        uint256 amount;
        uint256 deadline;
        bytes32 expectedArtifactHash;
        bytes32 actualArtifactHash;
        ArbitrationPolicy policy;
        EscrowStatus status;
        uint256 createdAt;
        uint256 deliveredAt;
    }

    IERC20 public immutable usdcToken;
    address public arbiterSigner;
    address public arbiterTreasury;
    address public owner;

    // Escrow storage: escrowId => EscrowDeal
    mapping(bytes32 => EscrowDeal) public escrows;
    // Replay protection for arbiter settlements
    mapping(bytes32 => bool) public executedRulings;

    // Events
    event EscrowCreated(
        bytes32 indexed escrowId,
        address indexed buyer,
        address indexed seller,
        uint256 amount,
        uint256 deadline,
        bytes32 expectedArtifactHash
    );

    event DeliverySubmitted(
        bytes32 indexed escrowId,
        address indexed seller,
        bytes32 actualArtifactHash,
        uint256 deliveredAt
    );

    event DisputeRaised(
        bytes32 indexed escrowId,
        address indexed raisedBy,
        string reason
    );

    event EscrowSettled(
        bytes32 indexed escrowId,
        Ruling ruling,
        uint256 sellerPayout,
        uint256 buyerRefund,
        uint256 arbiterFee
    );

    event EscrowRefunded(bytes32 indexed escrowId, address indexed buyer, uint256 amount);
    event ArbiterSignerUpdated(address oldSigner, address newSigner);
    event ArbiterTreasuryUpdated(address oldTreasury, address newTreasury);

    modifier onlyOwner() {
        require(msg.sender == owner, "Only owner");
        _;
    }

    /**
     * @notice Constructor initializes the Base USDC token and Arbiter credentials.
     * @param _usdc Token contract address (Base USDC: 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913)
     * @param _arbiterSigner Public key address of the m2m-escrow-arbiter quorum
     * @param _arbiterTreasury Treasury address receiving the 1% arbiter fee
     */
    constructor(
        address _usdc,
        address _arbiterSigner,
        address _arbiterTreasury
    ) {
        require(_usdc != address(0), "Invalid USDC address");
        require(_arbiterSigner != address(0), "Invalid arbiter signer");
        require(_arbiterTreasury != address(0), "Invalid arbiter treasury");
        usdcToken = IERC20(_usdc);
        arbiterSigner = _arbiterSigner;
        arbiterTreasury = _arbiterTreasury;
        owner = msg.sender;
    }

    /**
     * @notice Buyer agent creates and funds an escrow for an M2M deliverable.
     */
    function createEscrow(
        bytes32 escrowId,
        address seller,
        uint256 amount,
        uint256 deadline,
        bytes32 expectedArtifactHash,
        ArbitrationPolicy policy
    ) external {
        require(escrows[escrowId].buyer == address(0), "Escrow already exists");
        require(seller != address(0) && seller != msg.sender, "Invalid seller address");
        require(amount > 0, "Amount must be > 0");
        require(deadline > block.timestamp, "Deadline must be in future");

        // Lock USDC from buyer into this contract
        require(usdcToken.transferFrom(msg.sender, address(this), amount), "USDC transfer failed");

        escrows[escrowId] = EscrowDeal({
            escrowId: escrowId,
            buyer: msg.sender,
            seller: seller,
            amount: amount,
            deadline: deadline,
            expectedArtifactHash: expectedArtifactHash,
            actualArtifactHash: bytes32(0),
            policy: policy,
            status: EscrowStatus.CREATED,
            createdAt: block.timestamp,
            deliveredAt: 0
        });

        emit EscrowCreated(escrowId, msg.sender, seller, amount, deadline, expectedArtifactHash);
    }

    /**
     * @notice Seller agent submits delivery evidence (SHA-256 hash of deliverable).
     */
    function submitDelivery(bytes32 escrowId, bytes32 actualArtifactHash) external {
        EscrowDeal storage deal = escrows[escrowId];
        require(deal.buyer != address(0), "Escrow does not exist");
        require(msg.sender == deal.seller, "Only seller can submit");
        require(deal.status == EscrowStatus.CREATED, "Invalid status");
        require(block.timestamp <= deal.deadline, "Deadline passed");
        require(actualArtifactHash != bytes32(0), "Invalid artifact hash");

        deal.actualArtifactHash = actualArtifactHash;
        deal.deliveredAt = block.timestamp;
        deal.status = EscrowStatus.DELIVERED;

        emit DeliverySubmitted(escrowId, msg.sender, actualArtifactHash, block.timestamp);
    }

    /**
     * @notice Buyer confirms clean delivery and releases 100% payout to seller.
     */
    function releaseClean(bytes32 escrowId) external {
        EscrowDeal storage deal = escrows[escrowId];
        require(deal.buyer != address(0), "Escrow does not exist");
        require(msg.sender == deal.buyer, "Only buyer can release");
        require(
            deal.status == EscrowStatus.CREATED || deal.status == EscrowStatus.DELIVERED,
            "Invalid status"
        );

        deal.status = EscrowStatus.SETTLED;
        uint256 amount = deal.amount;

        require(usdcToken.transfer(deal.seller, amount), "Payout failed");
        emit EscrowSettled(escrowId, Ruling.RELEASE_TO_SELLER, amount, 0, 0);
    }

    /**
     * @notice Buyer claims 100% refund if deadline passed and seller failed to submit delivery.
     */
    function claimExpiredRefund(bytes32 escrowId) external {
        EscrowDeal storage deal = escrows[escrowId];
        require(deal.buyer != address(0), "Escrow does not exist");
        require(msg.sender == deal.buyer, "Only buyer can claim refund");
        require(deal.status == EscrowStatus.CREATED, "Already delivered or closed");
        require(block.timestamp > deal.deadline, "Deadline not reached");

        deal.status = EscrowStatus.REFUNDED;
        uint256 amount = deal.amount;

        require(usdcToken.transfer(deal.buyer, amount), "Refund transfer failed");
        emit EscrowRefunded(escrowId, deal.buyer, amount);
    }

    /**
     * @notice Either buyer or seller can flag a dispute if requirements or hashes do not match.
     */
    function raiseDispute(bytes32 escrowId, string calldata reason) external {
        EscrowDeal storage deal = escrows[escrowId];
        require(deal.buyer != address(0), "Escrow does not exist");
        require(
            msg.sender == deal.buyer || msg.sender == deal.seller,
            "Only deal parties can dispute"
        );
        require(
            deal.status == EscrowStatus.CREATED || deal.status == EscrowStatus.DELIVERED,
            "Cannot dispute in current status"
        );

        deal.status = EscrowStatus.DISPUTED;
        emit DisputeRaised(escrowId, msg.sender, reason);
    }

    /**
     * @notice Settles a dispute deterministically using an official ECDSA-signed ruling
     * from m2m-escrow-arbiter. Can be called by buyer, seller, or any autonomous relayer.
     */
    function settleDisputeWithArbiterRuling(
        bytes32 escrowId,
        Ruling ruling,
        uint256 sellerPayout,
        uint256 buyerRefund,
        uint256 arbiterFee,
        uint256 nonce,
        bytes calldata signature
    ) external {
        EscrowDeal storage deal = escrows[escrowId];
        require(deal.buyer != address(0), "Escrow does not exist");
        require(
            deal.status == EscrowStatus.CREATED ||
            deal.status == EscrowStatus.DELIVERED ||
            deal.status == EscrowStatus.DISPUTED,
            "Escrow already closed"
        );

        // Balance conservation check
        require(
            sellerPayout + buyerRefund + arbiterFee == deal.amount,
            "Payout sum must equal escrow amount"
        );

        // Prevent ruling replay
        bytes32 rulingHash = keccak256(
            abi.encodePacked(
                escrowId,
                uint8(ruling),
                sellerPayout,
                buyerRefund,
                arbiterFee,
                nonce,
                block.chainid,
                address(this)
            )
        );
        require(!executedRulings[rulingHash], "Ruling already executed");
        executedRulings[rulingHash] = true;

        // Verify cryptographic signature from m2m-escrow-arbiter signer
        bytes32 ethSignedHash = keccak256(
            abi.encodePacked("\x19Ethereum Signed Message:\n32", rulingHash)
        );
        address recoveredSigner = recoverSigner(ethSignedHash, signature);
        require(recoveredSigner == arbiterSigner, "Invalid arbiter signature");

        deal.status = EscrowStatus.SETTLED;

        // Execute deterministic payouts
        if (sellerPayout > 0) {
            require(usdcToken.transfer(deal.seller, sellerPayout), "Seller payout failed");
        }
        if (buyerRefund > 0) {
            require(usdcToken.transfer(deal.buyer, buyerRefund), "Buyer refund failed");
        }
        if (arbiterFee > 0) {
            require(usdcToken.transfer(arbiterTreasury, arbiterFee), "Arbiter fee transfer failed");
        }

        emit EscrowSettled(escrowId, ruling, sellerPayout, buyerRefund, arbiterFee);
    }

    /**
     * @notice Standard ECDSA signature recovery helper.
     */
    function recoverSigner(bytes32 messageHash, bytes memory sig) internal pure returns (address) {
        require(sig.length == 65, "Invalid signature length");
        bytes32 r;
        bytes32 s;
        uint8 v;
        assembly {
            r := mload(add(sig, 32))
            s := mload(add(sig, 64))
            v := byte(0, mload(add(sig, 96)))
        }
        if (v < 27) {
            v += 27;
        }
        require(v == 27 || v == 28, "Invalid signature v value");
        return ecrecover(messageHash, v, r, s);
    }

    /**
     * @notice Admin update of arbiter key if quorum rotates.
     */
    function setArbiterSigner(address _newSigner) external onlyOwner {
        require(_newSigner != address(0), "Invalid address");
        address old = arbiterSigner;
        arbiterSigner = _newSigner;
        emit ArbiterSignerUpdated(old, _newSigner);
    }

    /**
     * @notice Admin update of arbiter treasury address.
     */
    function setArbiterTreasury(address _newTreasury) external onlyOwner {
        require(_newTreasury != address(0), "Invalid address");
        address old = arbiterTreasury;
        arbiterTreasury = _newTreasury;
        emit ArbiterTreasuryUpdated(old, _newTreasury);
    }
}
