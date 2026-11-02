// Contract addresses and ABIs for PropChain smart contracts on local EVM (Chain ID 31337)

export const CONTRACT_ADDRESSES = {
  PROPERTY_REGISTRY: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
  OWNERSHIP_REGISTRY: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
  TRANSACTION_MANAGER: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
}

export const PROPERTY_REGISTRY_ABI = [
  'event PropertyRegistered(string indexed propertyId, address indexed ownerWallet, bytes32 documentHash, uint256 timestamp)',
  'event PropertyDocumentUpdated(string indexed propertyId, bytes32 newDocumentHash, uint256 timestamp)',
  'event PropertyStateChanged(string indexed propertyId, uint8 newState, uint256 timestamp)',
  'function registerProperty(string calldata propertyId, address ownerWallet, bytes32 documentHash) external',
  'function getProperty(string calldata propertyId) external view returns (address currentOwner, bytes32 documentHash, uint8 state, uint256 registeredAt, uint256 updatedAt, bool exists)',
  'function totalProperties() external view returns (uint256)',
]

export const OWNERSHIP_REGISTRY_ABI = [
  'event InitialOwnershipRecorded(string indexed propertyId, address indexed initialOwner, uint256 timestamp)',
  'event OwnershipTransferred(string indexed propertyId, address indexed previousOwner, address indexed newOwner, string transactionId, uint256 timestamp)',
  'function recordInitialOwnership(string calldata propertyId, address ownerWallet) external',
  'function recordOwnershipTransfer(string calldata propertyId, address previousOwner, address newOwner, string calldata transactionId) external',
  'function getCurrentOwner(string calldata propertyId) external view returns (address)',
  'function getOwnershipHistory(string calldata propertyId) external view returns (tuple(address previousOwner, address newOwner, string transactionId, uint256 timestamp, uint256 blockNumber)[])',
]

export const TRANSACTION_MANAGER_ABI = [
  'event TransactionCreated(string indexed transactionId, string indexed propertyId, address indexed buyer, address seller, uint256 amount, uint256 timestamp)',
  'event TransactionAccepted(string indexed transactionId, address indexed seller, uint256 timestamp)',
  'event TransactionDocumentsVerified(string indexed transactionId, address indexed verifier, uint256 timestamp)',
  'event TransactionLegallyConfirmed(string indexed transactionId, address indexed legalAuthority, uint256 timestamp)',
  'event TransactionCompleted(string indexed transactionId, string indexed propertyId, address newOwner, uint256 timestamp)',
  'function getTransaction(string calldata transactionId) external view returns (string propertyId, address buyer, address seller, uint256 amount, uint8 status, bool sellerAccepted, bool documentsVerified, bool legallyConfirmed, uint256 createdAt, uint256 completedAt, bool exists)',
]
