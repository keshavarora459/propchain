// Contract addresses, ABIs, and network configuration for PropChain
// Supports both Ethereum Sepolia Testnet (11155111) and Localhost EVM (31337)

export const SEPOLIA_CHAIN_ID = 11155111
export const LOCAL_CHAIN_ID = 31337

export interface NetworkConfig {
  chainId: number
  name: string
  rpcUrl: string
  explorerUrl: string
  currency: {
    name: string
    symbol: string
    decimals: number
  }
}

export const NETWORKS: Record<number, NetworkConfig> = {
  [SEPOLIA_CHAIN_ID]: {
    chainId: SEPOLIA_CHAIN_ID,
    name: 'Ethereum Sepolia',
    rpcUrl: import.meta.env.VITE_BLOCKCHAIN_RPC_URL || 'https://rpc.sepolia.org',
    explorerUrl: 'https://sepolia.etherscan.io',
    currency: {
      name: 'Sepolia ETH',
      symbol: 'ETH',
      decimals: 18,
    },
  },
  [LOCAL_CHAIN_ID]: {
    chainId: LOCAL_CHAIN_ID,
    name: 'Hardhat EVM Localhost',
    rpcUrl: 'http://127.0.0.1:8545',
    explorerUrl: '',
    currency: {
      name: 'Ethereum',
      symbol: 'ETH',
      decimals: 18,
    },
  },
}

// Contract addresses loaded from environment configuration
export const CONTRACT_ADDRESSES = {
  PROPERTY_REGISTRY: import.meta.env.VITE_PROPERTY_REGISTRY_ADDRESS || '',
  OWNERSHIP_REGISTRY: import.meta.env.VITE_OWNERSHIP_REGISTRY_ADDRESS || '',
  TRANSACTION_MANAGER: import.meta.env.VITE_TRANSACTION_MANAGER_ADDRESS || '',
}

export const getExplorerTxUrl = (hash: string, chainId: number = SEPOLIA_CHAIN_ID): string => {
  if (!hash) return '#'
  if (chainId === SEPOLIA_CHAIN_ID || hash.startsWith('0x')) {
    return `https://sepolia.etherscan.io/tx/${hash}`
  }
  return '#'
}

export const getExplorerAddressUrl = (address: string, chainId: number = SEPOLIA_CHAIN_ID): string => {
  if (!address) return '#'
  if (chainId === SEPOLIA_CHAIN_ID || address.startsWith('0x')) {
    return `https://sepolia.etherscan.io/address/${address}`
  }
  return '#'
}

export const CONTRACT_DEPLOYMENT_INFO = {
  PROPERTY_REGISTRY: {
    address: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    name: 'PropertyRegistry',
    deploymentTxHash: '0xa7c140b7328a99cfe2980e4cd0fd52bdba4644f2a3e3aff06dba96164580880b',
    deploymentBlock: 1,
    deployedAt: '2026-11-03T16:54:58.948Z',
    status: 'Active',
    abiStatus: 'Verified',
    purpose: 'Anchors verified title deeds and canonical land parcel registry records on-chain.',
  },
  OWNERSHIP_REGISTRY: {
    address: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
    name: 'OwnershipRegistry',
    deploymentTxHash: '0x2a66d0ebbc1008bab413e3ed4bd095411a5c27df4fd76f04d815eaef42ecedd0',
    deploymentBlock: 2,
    deployedAt: '2026-11-03T16:54:58.948Z',
    status: 'Active',
    abiStatus: 'Verified',
    purpose: 'Immutable chronological conveyance ledger and current registered owner lookup.',
  },
  TRANSACTION_MANAGER: {
    address: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
    name: 'TransactionManager',
    deploymentTxHash: '0x681a77d7fa59724b712ccbc3459bff4b1bf95964283c8f1f1615c1ee4a7a6afd',
    deploymentBlock: 4,
    deployedAt: '2026-11-03T16:54:58.948Z',
    status: 'Active',
    abiStatus: 'Verified',
    purpose: 'Multi-signature escrow state machine enforcing seller, verifier, and legal sign-offs.',
  },
}

export const PROPERTY_REGISTRY_ABI = [
  'event PropertyRegistered(string indexed propertyId, address indexed ownerWallet, bytes32 documentHash, uint256 timestamp)',
  'event PropertyDocumentUpdated(string indexed propertyId, bytes32 newDocumentHash, uint256 timestamp)',
  'event PropertyStateChanged(string indexed propertyId, uint8 newState, uint256 timestamp)',
  'function registerProperty(string calldata propertyId, address ownerWallet, bytes32 documentHash) external',
  'function updateDocumentHash(string calldata propertyId, bytes32 newDocumentHash) external',
  'function setPropertyState(string calldata propertyId, uint8 newState) external',
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
  'function getTransferCount(string calldata propertyId) external view returns (uint256)',
]

export const TRANSACTION_MANAGER_ABI = [
  'event TransactionCreated(string indexed transactionId, string indexed propertyId, address indexed buyer, address seller, uint256 amount, uint256 timestamp)',
  'event TransactionAccepted(string indexed transactionId, address indexed seller, uint256 timestamp)',
  'event TransactionDocumentsVerified(string indexed transactionId, address indexed verifier, uint256 timestamp)',
  'event TransactionLegallyConfirmed(string indexed transactionId, address indexed legalAuthority, uint256 timestamp)',
  'event TransactionCompleted(string indexed transactionId, string indexed propertyId, address newOwner, uint256 timestamp)',
  'event TransactionCancelled(string indexed transactionId, string reason, uint256 timestamp)',
  'function createTransaction(string calldata transactionId, string calldata propertyId, address buyer, address seller, uint256 amount) external',
  'function acceptTransaction(string calldata transactionId) external',
  'function approveDocuments(string calldata transactionId) external',
  'function confirmLegalRegistration(string calldata transactionId) external',
  'function completeTransfer(string calldata transactionId) external',
  'function cancelTransaction(string calldata transactionId, string calldata reason) external',
  'function getTransaction(string calldata transactionId) external view returns (string propertyId, address buyer, address seller, uint256 amount, uint8 status, bool sellerAccepted, bool documentsVerified, bool legallyConfirmed, uint256 createdAt, uint256 completedAt, bool exists)',
]

export const ACCESS_CONTROL_ABI = [
  'function grantRole(bytes32 role, address account) external',
  'function revokeRole(bytes32 role, address account) external',
  'function hasRole(bytes32 role, address account) external view returns (bool)',
  'event RoleGranted(bytes32 indexed role, address indexed account, address indexed sender)',
  'event RoleRevoked(bytes32 indexed role, address indexed account, address indexed sender)',
]
