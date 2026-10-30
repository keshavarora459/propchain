// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title PropertyRegistry
 * @dev Manages blockchain-anchored digital deeds and document integrity hashes for PropChain.
 * Uses opaque platform property identifiers and cryptographic SHA-256 hashes to safeguard privacy.
 */
contract PropertyRegistry is AccessControl {
    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");
    bytes32 public constant VERIFIER_ROLE = keccak256("VERIFIER_ROLE");

    enum RegistryState { Unregistered, Registered, UnderReview, Verified, Suspended }

    struct PropertyRecord {
        string propertyId;
        address currentOwner;
        bytes32 documentHash;
        RegistryState state;
        uint256 registeredAt;
        uint256 updatedAt;
        bool exists;
    }

    // propertyId => PropertyRecord
    mapping(string => PropertyRecord) private _properties;
    string[] private _allPropertyIds;

    // Events
    event PropertyRegistered(
        string indexed propertyId,
        address indexed ownerWallet,
        bytes32 documentHash,
        uint256 timestamp
    );

    event PropertyDocumentUpdated(
        string indexed propertyId,
        bytes32 newDocumentHash,
        uint256 timestamp
    );

    event PropertyStateChanged(
        string indexed propertyId,
        RegistryState newState,
        uint256 timestamp
    );

    // Custom errors
    error PropertyAlreadyRegistered(string propertyId);
    error PropertyNotFound(string propertyId);
    error InvalidZeroAddress();
    error EmptyIdentifier();

    constructor(address admin) {
        if (admin == address(0)) revert InvalidZeroAddress();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(REGISTRAR_ROLE, admin);
        _grantRole(VERIFIER_ROLE, admin);
    }

    /**
     * @notice Register a newly verified platform property.
     * @param propertyId Unique alphanumeric platform property identifier.
     * @param ownerWallet EVM wallet address of the registered owner.
     * @param documentHash Cryptographic SHA-256 hash of the verified title deed.
     */
    function registerProperty(
        string calldata propertyId,
        address ownerWallet,
        bytes32 documentHash
    ) external onlyRole(REGISTRAR_ROLE) {
        if (bytes(propertyId).length == 0) revert EmptyIdentifier();
        if (ownerWallet == address(0)) revert InvalidZeroAddress();
        if (_properties[propertyId].exists) revert PropertyAlreadyRegistered(propertyId);

        _properties[propertyId] = PropertyRecord({
            propertyId: propertyId,
            currentOwner: ownerWallet,
            documentHash: documentHash,
            state: RegistryState.Registered,
            registeredAt: block.timestamp,
            updatedAt: block.timestamp,
            exists: true
        });

        _allPropertyIds.push(propertyId);

        emit PropertyRegistered(propertyId, ownerWallet, documentHash, block.timestamp);
    }

    /**
     * @notice Update anchor document hash for an existing property.
     */
    function updateDocumentHash(
        string calldata propertyId,
        bytes32 newDocumentHash
    ) external onlyRole(VERIFIER_ROLE) {
        if (!_properties[propertyId].exists) revert PropertyNotFound(propertyId);

        _properties[propertyId].documentHash = newDocumentHash;
        _properties[propertyId].updatedAt = block.timestamp;

        emit PropertyDocumentUpdated(propertyId, newDocumentHash, block.timestamp);
    }

    /**
     * @notice Transition registry status (e.g. Verified, Suspended).
     */
    function setPropertyState(
        string calldata propertyId,
        RegistryState newState
    ) external onlyRole(VERIFIER_ROLE) {
        if (!_properties[propertyId].exists) revert PropertyNotFound(propertyId);

        _properties[propertyId].state = newState;
        _properties[propertyId].updatedAt = block.timestamp;

        emit PropertyStateChanged(propertyId, newState, block.timestamp);
    }

    /**
     * @notice Update the on-chain recorded owner wallet (called by authorized OwnershipRegistry).
     */
    function updateOwner(
        string calldata propertyId,
        address newOwner
    ) external onlyRole(REGISTRAR_ROLE) {
        if (!_properties[propertyId].exists) revert PropertyNotFound(propertyId);
        if (newOwner == address(0)) revert InvalidZeroAddress();

        _properties[propertyId].currentOwner = newOwner;
        _properties[propertyId].updatedAt = block.timestamp;
    }

    /**
     * @notice Read property record.
     */
    function getProperty(string calldata propertyId)
        external
        view
        returns (
            address currentOwner,
            bytes32 documentHash,
            RegistryState state,
            uint256 registeredAt,
            uint256 updatedAt,
            bool exists
        )
    {
        PropertyRecord storage p = _properties[propertyId];
        return (p.currentOwner, p.documentHash, p.state, p.registeredAt, p.updatedAt, p.exists);
    }

    function totalProperties() external view returns (uint256) {
        return _allPropertyIds.length;
    }
}

