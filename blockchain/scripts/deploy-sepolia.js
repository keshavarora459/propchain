const fs = require("fs");
const path = require("path");
const { ethers, network } = require("hardhat");

async function main() {
  console.log("==================================================");
  console.log("PropChain Ethereum Sepolia Smart Contract Deployment");
  console.log(`Network: ${network.name} (Chain ID: ${network.config.chainId})`);
  console.log("==================================================");

  if (network.name !== "sepolia") {
    console.warn(`WARNING: Target network is '${network.name}', expected 'sepolia'.`);
  }

  const signers = await ethers.getSigners();
  if (!signers || signers.length === 0) {
    throw new Error(
      "No deployer account found for Sepolia. Ensure SEPOLIA_PRIVATE_KEY is set in blockchain/.env"
    );
  }

  const deployer = signers[0];
  console.log(`Deployer Address: ${deployer.address}`);

  const balance = await ethers.provider.getBalance(deployer.address);
  const balanceEth = ethers.formatEther(balance);
  console.log(`Deployer Balance: ${balanceEth} SepoliaETH`);

  if (balance === 0n) {
    throw new Error(
      `Deployer account ${deployer.address} has 0 SepoliaETH. Please fund this address using a Sepolia faucet (e.g. https://sepoliafaucet.com or https://cloud.google.com/application/web3/faucet/ethereum/sepolia) before deploying.`
    );
  }

  // 1. Deploy PropertyRegistry
  console.log("\n[1/3] Deploying PropertyRegistry...");
  const PropertyRegistry = await ethers.getContractFactory("PropertyRegistry");
  const propertyRegistry = await PropertyRegistry.deploy(deployer.address);
  console.log("  -> Submitting transaction... awaiting confirmation");
  await propertyRegistry.waitForDeployment();
  const propertyRegistryAddress = await propertyRegistry.getAddress();
  const prDeployTx = propertyRegistry.deploymentTransaction();
  console.log(`  -> PropertyRegistry deployed at: ${propertyRegistryAddress}`);
  console.log(`  -> Tx Hash: ${prDeployTx ? prDeployTx.hash : "confirmed"}`);
  console.log(`  -> Etherscan: https://sepolia.etherscan.io/address/${propertyRegistryAddress}`);

  // 2. Deploy OwnershipRegistry
  console.log("\n[2/3] Deploying OwnershipRegistry...");
  const OwnershipRegistry = await ethers.getContractFactory("OwnershipRegistry");
  const ownershipRegistry = await OwnershipRegistry.deploy(deployer.address, propertyRegistryAddress);
  console.log("  -> Submitting transaction... awaiting confirmation");
  await ownershipRegistry.waitForDeployment();
  const ownershipRegistryAddress = await ownershipRegistry.getAddress();
  const orDeployTx = ownershipRegistry.deploymentTransaction();
  console.log(`  -> OwnershipRegistry deployed at: ${ownershipRegistryAddress}`);
  console.log(`  -> Tx Hash: ${orDeployTx ? orDeployTx.hash : "confirmed"}`);
  console.log(`  -> Etherscan: https://sepolia.etherscan.io/address/${ownershipRegistryAddress}`);

  // Grant REGISTRAR_ROLE to OwnershipRegistry
  console.log("  -> Linking roles: Granting REGISTRAR_ROLE to OwnershipRegistry...");
  const REGISTRAR_ROLE = await propertyRegistry.REGISTRAR_ROLE();
  const grantTx1 = await propertyRegistry.grantRole(REGISTRAR_ROLE, ownershipRegistryAddress);
  await grantTx1.wait(2);
  console.log("  -> Granted REGISTRAR_ROLE on PropertyRegistry to OwnershipRegistry");

  // 3. Deploy TransactionManager
  console.log("\n[3/3] Deploying TransactionManager...");
  const TransactionManager = await ethers.getContractFactory("TransactionManager");
  const transactionManager = await TransactionManager.deploy(deployer.address, ownershipRegistryAddress);
  console.log("  -> Submitting transaction... awaiting confirmation");
  await transactionManager.waitForDeployment();
  const transactionManagerAddress = await transactionManager.getAddress();
  const tmDeployTx = transactionManager.deploymentTransaction();
  console.log(`  -> TransactionManager deployed at: ${transactionManagerAddress}`);
  console.log(`  -> Tx Hash: ${tmDeployTx ? tmDeployTx.hash : "confirmed"}`);
  console.log(`  -> Etherscan: https://sepolia.etherscan.io/address/${transactionManagerAddress}`);

  // Grant TRANSFER_ROLE on OwnershipRegistry to TransactionManager
  console.log("  -> Linking roles: Granting TRANSFER_ROLE to TransactionManager...");
  const TRANSFER_ROLE = await ownershipRegistry.TRANSFER_ROLE();
  const grantTx2 = await ownershipRegistry.grantRole(TRANSFER_ROLE, transactionManagerAddress);
  await grantTx2.wait(2);
  console.log("  -> Granted TRANSFER_ROLE on OwnershipRegistry to TransactionManager");

  // Prepare deployment artifact
  const deploymentData = {
    network: "sepolia",
    chainId: 11155111,
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    explorerBaseUrl: "https://sepolia.etherscan.io",
    contracts: {
      PropertyRegistry: {
        address: propertyRegistryAddress,
        deploymentTx: prDeployTx ? prDeployTx.hash : null,
        constructorArgs: [deployer.address],
        abi: JSON.parse(PropertyRegistry.interface.formatJson()),
      },
      OwnershipRegistry: {
        address: ownershipRegistryAddress,
        deploymentTx: orDeployTx ? orDeployTx.hash : null,
        constructorArgs: [deployer.address, propertyRegistryAddress],
        abi: JSON.parse(OwnershipRegistry.interface.formatJson()),
      },
      TransactionManager: {
        address: transactionManagerAddress,
        deploymentTx: tmDeployTx ? tmDeployTx.hash : null,
        constructorArgs: [deployer.address, ownershipRegistryAddress],
        abi: JSON.parse(TransactionManager.interface.formatJson()),
      },
    },
  };

  // Write to blockchain/deployments/sepolia.json
  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  const sepoliaArtifactPath = path.join(deploymentsDir, "sepolia.json");
  fs.writeFileSync(sepoliaArtifactPath, JSON.stringify(deploymentData, null, 2));
  console.log(`\nDeployment artifact written to: ${sepoliaArtifactPath}`);

  // Write frontend config copy
  const frontendContractsDir = path.join(__dirname, "..", "..", "frontend", "src", "contracts");
  if (fs.existsSync(frontendContractsDir)) {
    const frontendSepoliaPath = path.join(frontendContractsDir, "deployments.sepolia.json");
    fs.writeFileSync(frontendSepoliaPath, JSON.stringify(deploymentData, null, 2));
    console.log(`Frontend deployment artifact updated at: ${frontendSepoliaPath}`);
  }

  console.log("\n==================================================");
  console.log("Deployment on Ethereum Sepolia Complete!");
  console.log("==================================================");
  console.log("\nEtherscan Verification Commands:");
  console.log(`npx hardhat verify --network sepolia ${propertyRegistryAddress} "${deployer.address}"`);
  console.log(`npx hardhat verify --network sepolia ${ownershipRegistryAddress} "${deployer.address}" "${propertyRegistryAddress}"`);
  console.log(`npx hardhat verify --network sepolia ${transactionManagerAddress} "${deployer.address}" "${ownershipRegistryAddress}"`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Sepolia Deployment Failed:", error);
    process.exit(1);
  });

