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
  console.log(`  -> PropertyRegistry deployed at: ${propertyRegistryAddress}`);

  // 2. Deploy OwnershipRegistry
  console.log("\n[2/3] Deploying OwnershipRegistry...");
  const OwnershipRegistry = await ethers.getContractFactory("OwnershipRegistry");
  const ownershipRegistry = await OwnershipRegistry.deploy(deployer.address, propertyRegistryAddress);
  await ownershipRegistry.waitForDeployment();
  const ownershipRegistryAddress = await ownershipRegistry.getAddress();
  console.log(`  -> OwnershipRegistry deployed at: ${ownershipRegistryAddress}`);

  // Grant REGISTRAR_ROLE to OwnershipRegistry so it can update owner pointers
  const REGISTRAR_ROLE = await propertyRegistry.REGISTRAR_ROLE();
  const grantTx1 = await propertyRegistry.grantRole(REGISTRAR_ROLE, ownershipRegistryAddress);
  await grantTx1.wait();
  console.log("  -> Granted REGISTRAR_ROLE on PropertyRegistry to OwnershipRegistry");

  // 3. Deploy TransactionManager
  console.log("\n[3/3] Deploying TransactionManager...");
  const TransactionManager = await ethers.getContractFactory("TransactionManager");
  const transactionManager = await TransactionManager.deploy(deployer.address, ownershipRegistryAddress);
  await transactionManager.waitForDeployment();
  const transactionManagerAddress = await transactionManager.getAddress();
  console.log(`  -> TransactionManager deployed at: ${transactionManagerAddress}`);

  // Grant TRANSFER_ROLE on OwnershipRegistry to TransactionManager
  const TRANSFER_ROLE = await ownershipRegistry.TRANSFER_ROLE();
  const grantTx2 = await ownershipRegistry.grantRole(TRANSFER_ROLE, transactionManagerAddress);
  await grantTx2.wait();
  console.log("  -> Granted TRANSFER_ROLE on OwnershipRegistry to TransactionManager");

  // Prepare deployment export data
  const deploymentData = {
    network: network.name,
    chainId: network.config.chainId || 31337,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    contracts: {
      PropertyRegistry: {
        address: propertyRegistryAddress,
        abi: JSON.parse(PropertyRegistry.interface.formatJson()),
      },
      OwnershipRegistry: {
        address: ownershipRegistryAddress,
        abi: JSON.parse(OwnershipRegistry.interface.formatJson()),
      },
      TransactionManager: {
        address: transactionManagerAddress,
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
    OWNERSHIP_REGISTRY_ADDRESS: ownershipRegistryAddress,
    TRANSACTION_MANAGER_ADDRESS: transactionManagerAddress,
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

