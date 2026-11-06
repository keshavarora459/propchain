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

  const deploymentsDir = path.join(__dirname, "..", "deployments");
  const exportPath = path.join(deploymentsDir, "localhost.json");
  const summaryPath = path.join(deploymentsDir, "addresses.json");

  // Re-run safety check: if contracts already have bytecode at saved addresses, skip deployment
  if (fs.existsSync(exportPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(exportPath, "utf8"));
      const prAddr = existing.contracts?.PropertyRegistry?.address;
      const orAddr = existing.contracts?.OwnershipRegistry?.address;
      const tmAddr = existing.contracts?.TransactionManager?.address;
      if (prAddr && orAddr && tmAddr) {
        const [codePR, codeOR, codeTM] = await Promise.all([
          ethers.provider.getCode(prAddr),
          ethers.provider.getCode(orAddr),
          ethers.provider.getCode(tmAddr),
        ]);
        if (codePR !== "0x" && codeOR !== "0x" && codeTM !== "0x") {
          console.log("\n[SKIP] Smart contracts are already deployed and active at saved addresses:");
          console.log(`  -> PropertyRegistry: ${prAddr}`);
          console.log(`  -> OwnershipRegistry: ${orAddr}`);
          console.log(`  -> TransactionManager: ${tmAddr}`);
          console.log(`  -> Preserving existing setupEndBlock: ${existing.setupEndBlock ?? 1}`);
          console.log("--------------------------------------------------");
          return;
        }
      }
    } catch (e) {
      console.warn("Could not inspect existing deployment file, proceeding:", e.message);
    }
  }

  // Pre-calculate future contract addresses based on deployer nonces
  const currentNonce = await ethers.provider.getTransactionCount(deployer.address);
  console.log(`Starting Deployment from Nonce: ${currentNonce}`);

  const propertyRegistryAddress = ethers.getCreateAddress({ from: deployer.address, nonce: currentNonce });
  const ownershipRegistryAddress = ethers.getCreateAddress({ from: deployer.address, nonce: currentNonce + 1 });
  const transactionManagerAddress = ethers.getCreateAddress({ from: deployer.address, nonce: currentNonce + 2 });

  console.log("Pre-computed Contract Addresses:");
  console.log(`  -> PropertyRegistry (nonce ${currentNonce}): ${propertyRegistryAddress}`);
  console.log(`  -> OwnershipRegistry (nonce ${currentNonce + 1}): ${ownershipRegistryAddress}`);
  console.log(`  -> TransactionManager (nonce ${currentNonce + 2}): ${transactionManagerAddress}`);

  // Disable automining to bundle all setup transactions into as few blocks as possible
  console.log("\n[1/3] Disabling automining on local EVM node...");
  await network.provider.send("evm_setAutomine", [false]);

  const PropertyRegistry = await ethers.getContractFactory("PropertyRegistry");
  const OwnershipRegistry = await ethers.getContractFactory("OwnershipRegistry");
  const TransactionManager = await ethers.getContractFactory("TransactionManager");

  const REGISTRAR_ROLE = ethers.id("REGISTRAR_ROLE");
  const TRANSFER_ROLE = ethers.id("TRANSFER_ROLE");

  console.log("[2/3] Submitting all setup transactions with explicit nonces...");

  // 1. Deploy PropertyRegistry (nonce: currentNonce)
  const propRegDeployData = await PropertyRegistry.getDeployTransaction(deployer.address);
  const propRegTx = await deployer.sendTransaction({
    ...propRegDeployData,
    nonce: currentNonce,
  });

  // 2. Deploy OwnershipRegistry (nonce: currentNonce + 1)
  const ownRegDeployData = await OwnershipRegistry.getDeployTransaction(deployer.address, propertyRegistryAddress);
  const ownRegTx = await deployer.sendTransaction({
    ...ownRegDeployData,
    nonce: currentNonce + 1,
  });

  // 3. Deploy TransactionManager (nonce: currentNonce + 2)
  const txMgrDeployData = await TransactionManager.getDeployTransaction(deployer.address, ownershipRegistryAddress);
  const txMgrTx = await deployer.sendTransaction({
    ...txMgrDeployData,
    nonce: currentNonce + 2,
  });

  // 4. Grant REGISTRAR_ROLE on PropertyRegistry to OwnershipRegistry (nonce: currentNonce + 3)
  const grantTx1Data = PropertyRegistry.interface.encodeFunctionData("grantRole", [
    REGISTRAR_ROLE,
    ownershipRegistryAddress,
  ]);
  const grantTx1 = await deployer.sendTransaction({
    to: propertyRegistryAddress,
    data: grantTx1Data,
    nonce: currentNonce + 3,
  });

  // 5. Grant TRANSFER_ROLE on OwnershipRegistry to TransactionManager (nonce: currentNonce + 4)
  const grantTx2Data = OwnershipRegistry.interface.encodeFunctionData("grantRole", [
    TRANSFER_ROLE,
    transactionManagerAddress,
  ]);
  const grantTx2 = await deployer.sendTransaction({
    to: ownershipRegistryAddress,
    data: grantTx2Data,
    nonce: currentNonce + 4,
  });

  // Mine all setup transactions together in a single block
  console.log("[3/3] Mining all setup transactions together via evm_mine...");
  await network.provider.send("evm_mine");

  // Re-enable automining for normal workflow operations
  await network.provider.send("evm_setAutomine", [true]);

  // Await all transaction receipts
  const [propRegReceipt, ownRegReceipt, txMgrReceipt, grantTx1Receipt, grantTx2Receipt] = await Promise.all([
    propRegTx.wait(),
    ownRegTx.wait(),
    txMgrTx.wait(),
    grantTx1.wait(),
    grantTx2.wait(),
  ]);

  const setupEndBlock = await ethers.provider.getBlockNumber();
  console.log(`\nSetup confirmed! All contracts and roles mined in setup block: #${setupEndBlock}`);

  const nowIso = new Date().toISOString();

  // Prepare deployment export data with setupEndBlock
  const deploymentData = {
    network: network.name,
    chainId: network.config.chainId || 31337,
    setupEndBlock: setupEndBlock,
    deployedAt: nowIso,
    deployer: deployer.address,
    contracts: {
      PropertyRegistry: {
        address: propertyRegistryAddress,
        deploymentTxHash: propRegTx.hash,
        deploymentBlockNumber: propRegReceipt.blockNumber,
        deployedAt: nowIso,
        abi: JSON.parse(PropertyRegistry.interface.formatJson()),
      },
      OwnershipRegistry: {
        address: ownershipRegistryAddress,
        deploymentTxHash: ownRegTx.hash,
        deploymentBlockNumber: ownRegReceipt.blockNumber,
        deployedAt: nowIso,
        abi: JSON.parse(OwnershipRegistry.interface.formatJson()),
      },
      TransactionManager: {
        address: transactionManagerAddress,
        deploymentTxHash: txMgrTx.hash,
        deploymentBlockNumber: txMgrReceipt.blockNumber,
        deployedAt: nowIso,
        abi: JSON.parse(TransactionManager.interface.formatJson()),
      },
    },
  };

  // Ensure deployments directory exists
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  fs.writeFileSync(exportPath, JSON.stringify(deploymentData, null, 2));
  console.log(`Deployment artifact written to: ${exportPath}`);

  // Export summary addresses for easy frontend & backend consumption with SETUP_END_BLOCK
  const summaryData = {
    chainId: network.config.chainId || 31337,
    rpcUrl: "http://127.0.0.1:8545",
    SETUP_END_BLOCK: setupEndBlock,
    PROPERTY_REGISTRY_ADDRESS: propertyRegistryAddress,
    PROPERTY_REGISTRY_TX: propRegTx.hash,
    PROPERTY_REGISTRY_BLOCK: propRegReceipt.blockNumber,
    OWNERSHIP_REGISTRY_ADDRESS: ownershipRegistryAddress,
    OWNERSHIP_REGISTRY_TX: ownRegTx.hash,
    OWNERSHIP_REGISTRY_BLOCK: ownRegReceipt.blockNumber,
    TRANSACTION_MANAGER_ADDRESS: transactionManagerAddress,
    TRANSACTION_MANAGER_TX: txMgrTx.hash,
    TRANSACTION_MANAGER_BLOCK: txMgrReceipt.blockNumber,
    deployedAt: nowIso,
  };
  fs.writeFileSync(summaryPath, JSON.stringify(summaryData, null, 2));
  console.log(`Addresses artifact written to: ${summaryPath}`);

  console.log("--------------------------------------------------");
  console.log("Deployment Complete!");
  console.log("--------------------------------------------------");
}

main()
  .then(() => {
    process.exitCode = 0;
  })
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
