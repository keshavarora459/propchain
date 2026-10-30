// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IOwnershipRegistry {
    function recordOwnershipTransfer(
        string calldata propertyId,
        address previousOwner,
        address newOwner,
        string calldata transactionId
    ) external;
    function getCurrentOwner(string calldata propertyId) external view returns (address);
}

/**
 * @title TransactionManager
 * @dev Manages multi-stakeholder real estate conveyance state transitions on-chain.
 * Enforces mandatory sequential gates: Seller Acceptance -> Document Verification -> Legal Confirmation -> Blockchain Execution.
 */
contract TransactionManager is AccessControl, ReentrancyGuard {
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");
    bytes32 public constant LEGAL_AUTHORITY_ROLE = keccak256("LEGAL_AUTHORITY_ROLE");
    bytes32 public constant OPERATOR_ROLE = keccak256("OPERATOR_ROLE");

    enum TransactionStatus {
        Created,
        Accepted,
        DocumentsVerified,
        LegallyConfirmed,
        Completed,
        Cancelled
    }

    struct Transaction {
        string transactionId;
        string propertyId;
        address buyer;
        address seller;
        uint256 amount;
        TransactionStatus status;
        bool sellerAccepted;
        bool documentsVerified;
        bool legallyConfirmed;
        uint256 createdAt;
        uint256 completedAt;
        bool exists;
    }

    IOwnershipRegistry public ownershipRegistry;

    // transactionId => Transaction
    mapping(string => Transaction) private _transactions;
    string[] private _allTransactionIds;

    // Events
    event TransactionCreated(
        string indexed transactionId,
        string indexed propertyId,
        address indexed buyer,
        address seller,
        uint256 amount,
        uint256 timestamp
    );

    event TransactionAccepted(string indexed transactionId, address indexed seller, uint256 timestamp);
    event TransactionDocumentsVerified(string indexed transactionId, address indexed verifier, uint256 timestamp);
    event TransactionLegallyConfirmed(string indexed transactionId, address indexed legalAuthority, uint256 timestamp);
    event TransactionCompleted(string indexed transactionId, string indexed propertyId, address newOwner, uint256 timestamp);
    event TransactionCancelled(string indexed transactionId, string reason, uint256 timestamp);

    // Custom errors
    error InvalidZeroAddress();
    error EmptyIdentifier();
    error TransactionAlreadyExists(string transactionId);
    error TransactionNotFound(string transactionId);
    error UnauthorizedCaller();
    error InvalidStateTransition();
    error PrerequisitesNotMet();

    constructor(address admin, address _ownershipRegistry) {
        if (admin == address(0) || _ownershipRegistry == address(0)) revert InvalidZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(OPERATOR_ROLE, admin);
        _grantRole(VERIFIER_ROLE, admin);
        _grantRole(LEGAL_AUTHORITY_ROLE, admin);
        ownershipRegistry = IOwnershipRegistry(_ownershipRegistry);
    }

    /**
     * @notice Initialize a new property transfer transaction escrow reference on-chain.
     */
    function createTransaction(
        string calldata transactionId,
        string calldata propertyId,
        address buyer,
        address seller,
        uint256 amount
    ) external onlyRole(OPERATOR_ROLE) {
        if (bytes(transactionId).length == 0 || bytes(propertyId).length == 0) revert EmptyIdentifier();
        if (buyer == address(0) || seller == address(0)) revert InvalidZeroAddress();
        if (_transactions[transactionId].exists) revert TransactionAlreadyExists(transactionId);

        _transactions[transactionId] = Transaction({
            transactionId: transactionId,
            propertyId: propertyId,
            buyer: buyer,
            seller: seller,
            amount: amount,
            status: TransactionStatus.Created,
            sellerAccepted: false,
            documentsVerified: false,
            legallyConfirmed: false,
            createdAt: block.timestamp,
            completedAt: 0,
            exists: true
        });

        _allTransactionIds.push(transactionId);

        emit TransactionCreated(transactionId, propertyId, buyer, seller, amount, block.timestamp);
    }

    /**
     * @notice Step 1: Seller confirms willingness to transfer.
     */
    function acceptTransaction(string calldata transactionId) external {
        Transaction storage txn = _transactions[transactionId];
        if (!txn.exists) revert TransactionNotFound(transactionId);
        if (msg.sender != txn.seller && !hasRole(OPERATOR_ROLE, msg.sender)) revert UnauthorizedCaller();
        if (txn.status != TransactionStatus.Created) revert InvalidStateTransition();

        txn.sellerAccepted = true;
        txn.status = TransactionStatus.Accepted;

        emit TransactionAccepted(transactionId, msg.sender, block.timestamp);
    }

    /**
     * @notice Step 2: Certified Verifier attests title and encumbrance documents.
     */
    function approveDocuments(string calldata transactionId) external onlyRole(VERIFIER_ROLE) {
        Transaction storage txn = _transactions[transactionId];
        if (!txn.exists) revert TransactionNotFound(transactionId);
        if (!txn.sellerAccepted || txn.status != TransactionStatus.Accepted) revert PrerequisitesNotMet();

        txn.documentsVerified = true;
        txn.status = TransactionStatus.DocumentsVerified;

        emit TransactionDocumentsVerified(transactionId, msg.sender, block.timestamp);
    }

    /**
     * @notice Step 3: Legal Authority records statutory land registry registration.
     */
    function confirmLegalRegistration(string calldata transactionId) external onlyRole(LEGAL_AUTHORITY_ROLE) {
        Transaction storage txn = _transactions[transactionId];
        if (!txn.exists) revert TransactionNotFound(transactionId);
        if (!txn.documentsVerified || txn.status != TransactionStatus.DocumentsVerified) revert PrerequisitesNotMet();

        txn.legallyConfirmed = true;
        txn.status = TransactionStatus.LegallyConfirmed;

        emit TransactionLegallyConfirmed(transactionId, msg.sender, block.timestamp);
    }

    /**
     * @notice Step 4: Final blockchain conveyance execution and ownership ledger transfer.
     */
    function completeTransfer(string calldata transactionId) external onlyRole(OPERATOR_ROLE) nonReentrant {
        Transaction storage txn = _transactions[transactionId];
        if (!txn.exists) revert TransactionNotFound(transactionId);
        if (!txn.sellerAccepted || !txn.documentsVerified || !txn.legallyConfirmed) revert PrerequisitesNotMet();
        if (txn.status != TransactionStatus.LegallyConfirmed) revert InvalidStateTransition();

        txn.status = TransactionStatus.Completed;
        txn.completedAt = block.timestamp;

        // Record immutable transfer in OwnershipRegistry
        ownershipRegistry.recordOwnershipTransfer(
            txn.propertyId,
            txn.seller,
            txn.buyer,
            txn.transactionId
        );

        emit TransactionCompleted(transactionId, txn.propertyId, txn.buyer, block.timestamp);
    }

    /**
     * @notice Cancel transaction before completion.
     */
    function cancelTransaction(string calldata transactionId, string calldata reason) external {
        Transaction storage txn = _transactions[transactionId];
        if (!txn.exists) revert TransactionNotFound(transactionId);
        if (msg.sender != txn.seller && msg.sender != txn.buyer && !hasRole(OPERATOR_ROLE, msg.sender)) {
            revert UnauthorizedCaller();
        }
        if (txn.status == TransactionStatus.Completed || txn.status == TransactionStatus.Cancelled) {
            revert InvalidStateTransition();
        }

        txn.status = TransactionStatus.Cancelled;

        emit TransactionCancelled(transactionId, reason, block.timestamp);
    }

    /**
     * @notice Query transaction state.
     */
    function getTransaction(string calldata transactionId)
        external
        view
        returns (
            string memory propertyId,
            address buyer,
            address seller,
            uint256 amount,
            TransactionStatus status,
            bool sellerAccepted,
            bool documentsVerified,
            bool legallyConfirmed,
            uint256 createdAt,
            uint256 completedAt
        )
    {
        Transaction storage txn = _transactions[transactionId];
        if (!txn.exists) revert TransactionNotFound(transactionId);

        return (
            txn.propertyId,
            txn.buyer,
            txn.seller,
            txn.amount,
            txn.status,
            txn.sellerAccepted,
            txn.documentsVerified,
            txn.legallyConfirmed,
            txn.createdAt,
            txn.completedAt
        );
    }
}

