# PropChain Smart Contracts Reference

## 1. PropertyRegistry.sol
- **Address**: `0x5FbDB2315678afecb367f032d93F642f64180aa3`
- **Inheritance**: OpenZeppelin `AccessControl`
- **Roles**:
  - `DEFAULT_ADMIN_ROLE`
  - `REGISTRAR_ROLE`
  - `VERIFIER_ROLE`
- **Functions**:
  - `registerProperty(string propertyId, address ownerWallet, bytes32 documentHash)`
  - `updateDocumentHash(string propertyId, bytes32 newDocumentHash)`
  - `setPropertyState(string propertyId, RegistryState newState)`
  - `updateOwner(string propertyId, address newOwner)`
  - `getProperty(string propertyId) view returns (...)`
- **Events**:
  - `PropertyRegistered(string indexed propertyId, address indexed ownerWallet, bytes32 documentHash, uint256 timestamp)`

## 2. OwnershipRegistry.sol
- **Address**: `0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512`
- **Inheritance**: OpenZeppelin `AccessControl`
- **Roles**:
  - `DEFAULT_ADMIN_ROLE`
  - `TRANSFER_ROLE` (Granted to `TransactionManager` and operator)
- **Functions**:
  - `recordInitialOwnership(string propertyId, address ownerWallet)`
  - `recordOwnershipTransfer(string propertyId, address previousOwner, address newOwner, string transactionId)`
  - `getOwnershipHistory(string propertyId) view returns (OwnershipEvent[] memory)`
  - `getCurrentOwner(string propertyId) view returns (address)`
- **Events**:
  - `InitialOwnershipRecorded(string indexed propertyId, address indexed initialOwner, uint256 timestamp)`
  - `OwnershipTransferred(string indexed propertyId, address indexed previousOwner, address indexed newOwner, string transactionId, uint256 timestamp)`

## 3. TransactionManager.sol
- **Address**: `0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9`
- **Inheritance**: OpenZeppelin `AccessControl`, `ReentrancyGuard`
- **Roles**:
  - `DEFAULT_ADMIN_ROLE`
  - `OPERATOR_ROLE`
  - `VERIFIER_ROLE`
  - `LEGAL_AUTHORITY_ROLE`
- **Functions**:
  - `createTransaction(...)`
  - `acceptTransaction(string transactionId)`
  - `approveDocuments(string transactionId)`
  - `confirmLegalRegistration(string transactionId)`
  - `completeTransfer(string transactionId)`
  - `cancelTransaction(string transactionId, string reason)`
- **Events**:
  - `TransactionCreated`
  - `TransactionAccepted`
  - `TransactionDocumentsVerified`
  - `TransactionLegallyConfirmed`
  - `TransactionCompleted`
  - `TransactionCancelled`

