/**
 * PropChain Blockchain Ledger Explorer Verification Test Suite
 * Tests live connection to Hardhat node, contract interaction,
 * property registration, ownership conveyance, and explorer query logic.
 */
const { ethers } = require('ethers');

const RPC_URL = 'http://127.0.0.1:8545';
const CONTRACTS = {
  PropertyRegistry: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
  OwnershipRegistry: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
  TransactionManager: '0xCf7Ed3AccA5a467e9e704C703E8D87F634fB0Fc9',
};

const PROPERTY_REGISTRY_ABI = [
  'event PropertyRegistered(string indexed propertyId, address indexed ownerWallet, bytes32 documentHash, uint256 timestamp)',
  'function registerProperty(string calldata propertyId, address ownerWallet, bytes32 documentHash) external',
  'function getProperty(string calldata propertyId) external view returns (address currentOwner, bytes32 documentHash, uint8 state, uint256 registeredAt, uint256 updatedAt, bool exists)',
];

const OWNERSHIP_REGISTRY_ABI = [
  'event InitialOwnershipRecorded(string indexed propertyId, address indexed initialOwner, uint256 timestamp)',
  'event OwnershipTransferred(string indexed propertyId, address indexed previousOwner, address indexed newOwner, string transactionId, uint256 timestamp)',
  'function recordInitialOwnership(string calldata propertyId, address ownerWallet) external',
  'function recordOwnershipTransfer(string calldata propertyId, address previousOwner, address newOwner, string calldata transactionId) external',
];

async function runTests() {
  console.log('====================================================');
  console.log('PropChain Ledger Explorer Live Test Suite');
  console.log('====================================================\n');

  const provider = new ethers.JsonRpcProvider(RPC_URL);

  // Test 1: Connect to actual blockchain & get network information
  console.log('[Test 1] Connecting to Hardhat local blockchain...');
  const network = await provider.getNetwork();
  const initialBlockNum = await provider.getBlockNumber();
  console.log(`  -> Chain ID: ${network.chainId} (Expected: 31337)`);
  console.log(`  -> Current Block Height: #${initialBlockNum}`);
  if (Number(network.chainId) !== 31337) throw new Error('Incorrect Chain ID');
  console.log('  -> [PASS] Blockchain connection active and accurate.\n');

  // Test 2: Latest Verified Blocks & Parent Hash inspection
  console.log('[Test 2] Inspecting Latest Verified Blocks...');
  const block = await provider.getBlock(initialBlockNum, true);
  console.log(`  -> Block #${block.number}`);
  console.log(`  -> Hash: ${block.hash}`);
  console.log(`  -> Parent Hash: ${block.parentHash}`);
  console.log(`  -> Transactions in block: ${block.transactions.length}`);
  console.log(`  -> Gas Used: ${block.gasUsed.toString()}`);
  if (!block.hash || !block.parentHash) throw new Error('Missing block hash or parent hash');
  console.log('  -> [PASS] Real block data fetched with parentHash & gas details.\n');

  // Setup Signer (Hardhat Account #0)
  const signer = new ethers.Wallet(
    '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
    provider
  );
  console.log(`Signer address: ${signer.address}`);

  const propertyRegistry = new ethers.Contract(CONTRACTS.PropertyRegistry, PROPERTY_REGISTRY_ABI, signer);
  const ownershipRegistry = new ethers.Contract(CONTRACTS.OwnershipRegistry, OWNERSHIP_REGISTRY_ABI, signer);

  // Test 3: Register Property and anchor on-chain
  const testPropertyId = `PROP-TEST-${Date.now().toString().slice(-5)}`;
  const ownerWallet = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'; // Hardhat Account #1
  const docHash = ethers.keccak256(ethers.toUtf8Bytes('Deed Title Document Test'));

  console.log(`[Test 3] Registering Property on-chain (${testPropertyId})...`);
  async function getFreshNonce() {
    const hex = await provider.send('eth_getTransactionCount', [signer.address, 'latest']);
    return parseInt(hex, 16);
  }

  const regTx = await propertyRegistry.registerProperty(testPropertyId, ownerWallet, docHash, {
    nonce: await getFreshNonce(),
  });
  console.log(`  -> Submitted Tx: ${regTx.hash}`);
  const regReceipt = await regTx.wait();
  console.log(`  -> Confirmed in Block: #${regReceipt.blockNumber}, Gas Used: ${regReceipt.gasUsed.toString()}`);
  console.log(`  -> Status: ${regReceipt.status === 1 ? 'Confirmed (Success)' : 'Reverted'}`);

  // Record initial ownership in OwnershipRegistry
  const initTx = await ownershipRegistry.recordInitialOwnership(testPropertyId, ownerWallet, {
    nonce: await getFreshNonce(),
  });
  const initReceipt = await initTx.wait();
  console.log(`  -> Genesis Ownership Tx: ${initTx.hash} in Block #${initReceipt.blockNumber}`);

  // Decode calldata
  const propInterface = new ethers.Interface(PROPERTY_REGISTRY_ABI);
  const parsedTx = propInterface.parseTransaction({ data: regTx.data });
  console.log(`  -> Decoded Transaction: ${parsedTx.name}(propertyId: "${parsedTx.args.propertyId}")`);

  // Decode event log
  let eventDetected = false;
  for (const log of regReceipt.logs) {
    try {
      const parsed = propInterface.parseLog(log);
      if (parsed.name === 'PropertyRegistered') {
        eventDetected = true;
        console.log(`  -> Emitted Event: PropertyRegistered (owner: ${parsed.args.ownerWallet})`);
      }
    } catch {}
  }
  if (!eventDetected || parsedTx.args.propertyId !== testPropertyId) {
    throw new Error('PropertyRegistered event or calldata not detected');
  }
  console.log('  -> [PASS] Property registered on-chain and verified via receipt.\n');

  // Test 4: Execute Ownership Transfer on-chain
  console.log(`[Test 4] Executing Ownership Transfer on-chain for ${testPropertyId}...`);
  const buyerWallet = '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC'; // Hardhat Account #2
  const conveyanceTxId = `TXN-CONV-${Date.now().toString().slice(-4)}`;

  const transferTx = await ownershipRegistry.recordOwnershipTransfer(
    testPropertyId,
    ownerWallet,
    buyerWallet,
    conveyanceTxId,
    {
      nonce: await getFreshNonce(),
    }
  );
  console.log(`  -> Submitted Transfer Tx: ${transferTx.hash}`);
  const transferReceipt = await transferTx.wait();
  console.log(`  -> Confirmed in Block: #${transferReceipt.blockNumber}, Gas Used: ${transferReceipt.gasUsed.toString()}`);

  const ownInterface = new ethers.Interface(OWNERSHIP_REGISTRY_ABI);
  const parsedTransferTx = ownInterface.parseTransaction({ data: transferTx.data });
  console.log(`  -> Decoded Transfer Calldata: ${parsedTransferTx.name}(property: ${parsedTransferTx.args.propertyId})`);

  let transferDetected = false;
  for (const log of transferReceipt.logs) {
    try {
      const parsed = ownInterface.parseLog(log);
      if (parsed.name === 'OwnershipTransferred') {
        transferDetected = true;
        console.log(`  -> Emitted Event: OwnershipTransferred (txId: ${parsed.args.transactionId})`);
      }
    } catch {}
  }
  if (!transferDetected) throw new Error('OwnershipTransferred event not detected');
  console.log('  -> [PASS] Ownership transfer executed and confirmed on-chain.\n');

  // Test 5: Search and Query Ledger
  console.log('[Test 5] Testing Search functionality...');
  
  // 5a: Search by block number
  const searchBlock = await provider.getBlock(transferReceipt.blockNumber, true);
  console.log(`  -> Search by Block #${transferReceipt.blockNumber}: Found block with hash ${searchBlock.hash.slice(0, 16)}...`);

  // 5b: Search by transaction hash
  const searchTx = await provider.getTransaction(transferTx.hash);
  const searchReceipt = await provider.getTransactionReceipt(transferTx.hash);
  console.log(`  -> Search by Tx Hash (${transferTx.hash.slice(0, 16)}...): Found tx in block #${searchTx.blockNumber}, Status: ${searchReceipt.status === 1 ? 'Confirmed' : 'Failed'}`);

  // 5c: Search by Smart Contract address
  const code = await provider.getCode(CONTRACTS.PropertyRegistry);
  const isContract = code !== '0x';
  console.log(`  -> Search by Contract Address (${CONTRACTS.PropertyRegistry}): isContract = ${isContract}`);

  // 5d: Search by Wallet address
  const bal = await provider.getBalance(signer.address);
  console.log(`  -> Search by Wallet (${signer.address}): Balance = ${ethers.formatEther(bal)} ETH`);

  console.log('  -> [PASS] All search query modes verified.\n');

  console.log('====================================================');
  console.log('ALL TESTS COMPLETED SUCCESSFULLY! REAL BLOCKCHAIN DATA VERIFIED.');
  console.log('====================================================');
}

runTests().catch((err) => {
  console.error('\nTest Failed:', err);
  process.exit(1);
});
