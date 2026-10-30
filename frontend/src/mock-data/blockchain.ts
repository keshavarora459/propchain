import type { BlockchainBlock, BlockchainTx, BlockchainNetworkStatus } from '@/types/blockchain'

export const MOCK_NETWORK_STATUS: BlockchainNetworkStatus = {
  chainId: 31337,
  networkName: 'Hardhat EVM Local (Ethereum Compatible)',
  latestBlock: 5120894,
  gasPriceGwei: 21.4,
  syncStatus: 'Synced',
  nodeVersion: 'Hardhat/2.29.1/Node.js/v22.20.0',
}

export const MOCK_BLOCKS: BlockchainBlock[] = [
  {
    blockNumber: 5120894,
    hash: '0x9e1f2a4b6c8d0e2f4a6b8c0d2e4f8f2d5e1b9a4c3f7e6d0a2b8c4e6f1a3d5b7c',
    parentHash: '0x8f2d5e1b9a4c3f7e6d0a2b8c4e6f1a3d5b7c9e1f2a4b6c8d0e2f4a6b8c0d2e4f',
    timestamp: '2024-10-18T11:20:12Z',
    transactionsCount: 4,
    miner: '0x1234567890123456789012345678901234567890',
    gasUsed: '1,420,110 (47.3%)',
  },
  {
    blockNumber: 5120893,
    hash: '0x8f2d5e1b9a4c3f7e6d0a2b8c4e6f1a3d5b7c9e1f2a4b6c8d0e2f4a6b8c0d2e4f',
    parentHash: '0x7e6d0a2b8c4e6f1a3d5b7c9e1f2a4b6c8d0e2f4a6b8c0d2e4f8f2d5e1b9a4c3f',
    timestamp: '2024-10-18T11:20:00Z',
    transactionsCount: 2,
    miner: '0x1234567890123456789012345678901234567890',
    gasUsed: '680,410 (22.7%)',
  },
  {
    blockNumber: 5120892,
    hash: '0x7e6d0a2b8c4e6f1a3d5b7c9e1f2a4b6c8d0e2f4a6b8c0d2e4f8f2d5e1b9a4c3f',
    parentHash: '0x6c8d0e2f4a6b8c0d2e4f8f2d5e1b9a4c3f7e6d0a2b8c4e6f1a3d5b7c9e1f2a4b',
    timestamp: '2024-10-18T11:19:48Z',
    transactionsCount: 7,
    miner: '0x1234567890123456789012345678901234567890',
    gasUsed: '2,890,200 (96.3%)',
  },
]

export const MOCK_BLOCKCHAIN_TXS: BlockchainTx[] = [
  {
    hash: '0x9e1f2a4b6c8d0e2f4a6b8c0d2e4f8f2d5e1b9a4c3f7e6d0a2b8c4e6f1a3d5b7c',
    blockNumber: 5120894,
    from: '0x1C4a98D224b178F31E83a9B167DeC39b2F082731',
    to: '0x3A9E8b6e3f4211516eB70b138F9B6eFe715697F3',
    contractAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    value: '0.00 ETH (Escrow Locked)',
    fee: '0.0024 ETH',
    status: 'Confirmed',
    event: 'EscrowDepositReceived(propertyId=10041, amount=$12,500,000)',
    timestamp: '2024-10-18T11:20:12Z',
  },
  {
    hash: '0x6c8d0e2f4a6b8c0d2e4f8f2d5e1b9a4c3f7e6d0a2b8c4e6f1a3d5b7c9e1f2a4b',
    blockNumber: 5089120,
    from: '0x55A12D9e8C339F8B1728cE7812Aa9e7D14909aF2',
    to: '0x8B227C9E71F42b47D9d6a36De9dD28C5708892A1',
    contractAddress: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
    value: '0.00 ETH (Title Deed Mint)',
    fee: '0.0019 ETH',
    status: 'Confirmed',
    event: 'OwnershipTransferred(tokenId=10042, newOwner=0x55A1...)',
    timestamp: '2024-09-15T16:10:00Z',
  },
]

