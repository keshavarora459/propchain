// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";

interface IPropertyRegistry {
    function updateOwner(string calldata propertyId, address newOwner) external;
    function getProperty(string calldata propertyId)
        external
        view
        returns (address currentOwner, bytes32 documentHash, uint8 state, uint256 registeredAt, uint256 updatedAt, bool exists);
}

/**
 * @title OwnershipRegistry
 * @dev Maintains an immutable, tamper-evident chronological ledger of real estate conveyance events.
 */
contract OwnershipRegistry is AccessControl {
    bytes32 public constant TRANSFER_ROLE = keccak256("TRANSFER_ROLE");

    struct OwnershipEvent {
        address previousOwner;
        address newOwner;
        string transactionId;
        uint256 timestamp;
        uint256 blockNumber;
    }

    IPropertyRegistry public propertyRegistry;

    // propertyId => OwnershipEvent[]
    mapping(string => OwnershipEvent[]) private _ownershipHistories;
    mapping(string => address) private _currentOwners;

    // Events
    event InitialOwnershipRecorded(
        string indexed propertyId,
        address indexed initialOwner,
        uint256 timestamp
    );

    event OwnershipTransferred(
        string indexed propertyId,
        address indexed previousOwner,
        address indexed newOwner,
        string transactionId,
        uint256 timestamp
    );

    // Custom errors
    error InvalidZeroAddress();
    error EmptyIdentifier();
    error OwnershipMismatch(address expected, address actual);
    error InitialOwnershipAlreadyRecorded(string propertyId);

    constructor(address admin, address _propertyRegistry) {
        if (admin == address(0) || _propertyRegistry == address(0)) revert InvalidZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(TRANSFER_ROLE, admin);
        propertyRegistry = IPropertyRegistry(_propertyRegistry);
    }

    /**
     * @notice Record genesis ownership anchor for a newly registered property.
     */
    function recordInitialOwnership(
        string calldata propertyId,
        address ownerWallet
    ) external onlyRole(TRANSFER_ROLE) {
        if (bytes(propertyId).length == 0) revert EmptyIdentifier();
        if (ownerWallet == address(0)) revert InvalidZeroAddress();
        if (_currentOwners[propertyId] != address(0)) revert InitialOwnershipAlreadyRecorded(propertyId);

        _currentOwners[propertyId] = ownerWallet;

        _ownershipHistories[propertyId].push(OwnershipEvent({
            previousOwner: address(0),
            newOwner: ownerWallet,
            transactionId: "GENESIS",
            timestamp: block.timestamp,
            blockNumber: block.number
        }));

        emit InitialOwnershipRecorded(propertyId, ownerWallet, block.timestamp);
    }

    /**
     * @notice Append an authenticated conveyance event after full legal and stakeholder approval.
     */
    function recordOwnershipTransfer(
        string calldata propertyId,
        address previousOwner,
        address newOwner,
        string calldata transactionId
    ) external onlyRole(TRANSFER_ROLE) {
        if (bytes(propertyId).length == 0 || bytes(transactionId).length == 0) revert EmptyIdentifier();
        if (newOwner == address(0)) revert InvalidZeroAddress();

        address registeredCurrent = _currentOwners[propertyId];
        if (registeredCurrent != address(0) && registeredCurrent != previousOwner) {
            revert OwnershipMismatch(registeredCurrent, previousOwner);
        }

        _currentOwners[propertyId] = newOwner;

        _ownershipHistories[propertyId].push(OwnershipEvent({
            previousOwner: previousOwner,
            newOwner: newOwner,
            transactionId: transactionId,
            timestamp: block.timestamp,
            blockNumber: block.number
        }));

        // Sync with PropertyRegistry
        try propertyRegistry.updateOwner(propertyId, newOwner) {} catch {}

        emit OwnershipTransferred(propertyId, previousOwner, newOwner, transactionId, block.timestamp);
    }

    /**
     * @notice Read complete immutable conveyance history for a given property.
     */
    function getOwnershipHistory(string calldata propertyId)
        external
        view
        returns (OwnershipEvent[] memory)
    {
        return _ownershipHistories[propertyId];
    }

    /**
     * @notice Read current recorded owner wallet address.
     */
    function getCurrentOwner(string calldata propertyId) external view returns (address) {
        return _currentOwners[propertyId];
    }

    /**
     * @notice Get total transfer count for a parcel.
     */
    function getTransferCount(string calldata propertyId) external view returns (uint256) {
        return _ownershipHistories[propertyId].length;
    }
}

