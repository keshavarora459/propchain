const fs = require("fs");
const path = require("path");
const { ethers, network } = require("hardhat");

async function main() {
  console.log("--------------------------------------------------");
  console.log("PropChain EVM Smart Contract Deployment");
  console.log(`Network: ${network.name} (Chain ID: ${network.config.chainId || 31337})`);
  console.log("--------------------------------------------------");

  const [deployer] = await ethers.getSigners();
  console.log(`Deployer Account: ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log(`Deployer Balance: ${ethers.formatEther(balance)} ETH`);

  // 1. Deploy PropertyRegistry
  console.log("\n[1/3] Deploying PropertyRegistry...");
  const PropertyRegistry = await ethers.getContractFactory("PropertyRegistry");
  const propertyRegistry = await PropertyRegistry.deploy(deployer.address);
  await propertyRegistry.waitForDeployment();
  const propertyRegistryAddress = await propertyRegistry.getAddress();
  const propRegDeployTx = propertyRegistry.deploymentTransaction();
  const propRegReceipt = await propRegDeployTx.wait();
  console.log(`  -> PropertyRegistry deployed at: ${propertyRegistryAddress}`);
  console.log(`  -> Tx Hash: ${propRegDeployTx.hash} (Block #${propRegReceipt.blockNumber})`);

  // 2. Deploy OwnershipRegistry
  console.log("\n[2/3] Deploying OwnershipRegistry...");
  const OwnershipRegistry = await ethers.getContractFactory("OwnershipRegistry");
  const ownershipRegistry = await OwnershipRegistry.deploy(deployer.address, propertyRegistryAddress);
  await ownershipRegistry.waitForDeployment();
  const ownershipRegistryAddress = await ownershipRegistry.getAddress();
  const ownRegDeployTx = ownershipRegistry.deploymentTransaction();
  const ownRegReceipt = await ownRegDeployTx.wait();
  console.log(`  -> OwnershipRegistry deployed at: ${ownershipRegistryAddress}`);
  console.log(`  -> Tx Hash: ${ownRegDeployTx.hash} (Block #${ownRegReceipt.blockNumber})`);

  // Grant REGISTRAR_ROLE to OwnershipRegistry so it can update owner pointers
  const REGISTRAR_ROLE = await propertyRegistry.REGISTRAR_ROLE();
  const grantTx1 = await propertyRegistry.grantRole(REGISTRAR_ROLE, ownershipRegistryAddress);
  const grantTx1Receipt = await grantTx1.wait();
  console.log(`  -> Granted REGISTRAR_ROLE on PropertyRegistry to OwnershipRegistry (Block #${grantTx1Receipt.blockNumber})`);

  // 3. Deploy TransactionManager
  console.log("\n[3/3] Deploying TransactionManager...");
  const TransactionManager = await ethers.getContractFactory("TransactionManager");
  const transactionManager = await TransactionManager.deploy(deployer.address, ownershipRegistryAddress);
  await transactionManager.waitForDeployment();
  const transactionManagerAddress = await transactionManager.getAddress();
  const txMgrDeployTx = transactionManager.deploymentTransaction();
  const txMgrReceipt = await txMgrDeployTx.wait();
  console.log(`  -> TransactionManager deployed at: ${transactionManagerAddress}`);
  console.log(`  -> Tx Hash: ${txMgrDeployTx.hash} (Block #${txMgrReceipt.blockNumber})`);

  // Grant TRANSFER_ROLE on OwnershipRegistry to TransactionManager
  const TRANSFER_ROLE = await ownershipRegistry.TRANSFER_ROLE();
  const grantTx2 = await ownershipRegistry.grantRole(TRANSFER_ROLE, transactionManagerAddress);
  const grantTx2Receipt = await grantTx2.wait();
  console.log(`  -> Granted TRANSFER_ROLE on OwnershipRegistry to TransactionManager (Block #${grantTx2Receipt.blockNumber})`);

  const nowIso = new Date().toISOString();

  // Prepare deployment export data
  const deploymentData = {
    network: network.name,
    chainId: network.config.chainId || 31337,
    deployedAt: nowIso,
    deployer: deployer.address,
    contracts: {
      PropertyRegistry: {
        address: propertyRegistryAddress,
        deploymentTxHash: propRegDeployTx.hash,
        deploymentBlockNumber: propRegReceipt.blockNumber,
        deployedAt: nowIso,
        abi: JSON.parse(PropertyRegistry.interface.formatJson()),
      },
      OwnershipRegistry: {
        address: ownershipRegistryAddress,
        deploymentTxHash: ownRegDeployTx.hash,
        deploymentBlockNumber: ownRegReceipt.blockNumber,
        deployedAt: nowIso,
        abi: JSON.parse(OwnershipRegistry.interface.formatJson()),
      },
      TransactionManager: {
        address: transactionManagerAddress,
        deploymentTxHash: txMgrDeployTx.hash,
        deploymentBlockNumber: txMgrReceipt.blockNumber,
        deployedAt: nowIso,
        abi: JSON.parse(TransactionManager.interface.formatJson()),
      },
    },
  };

  // Ensure deployments directory exists
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const exportPath = path.join(deploymentsDir, "localhost.json");
  fs.writeFileSync(exportPath, JSON.stringify(deploymentData, null, 2));
  console.log(`\nDeployment artifact written to: ${exportPath}`);

  // Export summary addresses for easy frontend & backend consumption
  const summaryData = {
    chainId: network.config.chainId || 31337,
    rpcUrl: "http://127.0.0.1:8545",
    PROPERTY_REGISTRY_ADDRESS: propertyRegistryAddress,
    PROPERTY_REGISTRY_TX: propRegDeployTx.hash,
    PROPERTY_REGISTRY_BLOCK: propRegReceipt.blockNumber,
    OWNERSHIP_REGISTRY_ADDRESS: ownershipRegistryAddress,
    OWNERSHIP_REGISTRY_TX: ownRegDeployTx.hash,
    OWNERSHIP_REGISTRY_BLOCK: ownRegReceipt.blockNumber,
    TRANSACTION_MANAGER_ADDRESS: transactionManagerAddress,
    TRANSACTION_MANAGER_TX: txMgrDeployTx.hash,
    TRANSACTION_MANAGER_BLOCK: txMgrReceipt.blockNumber,
    deployedAt: nowIso,
  };
  fs.writeFileSync(
    path.join(deploymentsDir, "addresses.json"),
    JSON.stringify(summaryData, null, 2)
  );

  console.log("--------------------------------------------------");
  console.log("Deployment Complete!");
  console.log("--------------------------------------------------");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
