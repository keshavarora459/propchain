const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("PropChain Smart Contracts Test Suite", function () {
  let admin, seller, buyer, verifier, legalAuthority, operator, stranger;
  let propertyRegistry, ownershipRegistry, transactionManager;

  const sampleDocHash = ethers.keccak256(ethers.toUtf8Bytes("SAMPLE_OFFICIAL_DEED_HASH"));
  const propId1 = "PROP-2026-1001";
  const propId2 = "PROP-2026-1002";
  const txnId1 = "TXN-2026-9001";

  beforeEach(async function () {
    [admin, seller, buyer, verifier, legalAuthority, operator, stranger] = await ethers.getSigners();

    // 1. Deploy PropertyRegistry
    const PropertyRegistry = await ethers.getContractFactory("PropertyRegistry");
    propertyRegistry = await PropertyRegistry.deploy(admin.address);
    await propertyRegistry.waitForDeployment();

    // 2. Deploy OwnershipRegistry
    const OwnershipRegistry = await ethers.getContractFactory("OwnershipRegistry");
    ownershipRegistry = await OwnershipRegistry.deploy(admin.address, await propertyRegistry.getAddress());
    await ownershipRegistry.waitForDeployment();

    // Grant REGISTRAR_ROLE to OwnershipRegistry so it can update owners
    const REGISTRAR_ROLE = await propertyRegistry.REGISTRAR_ROLE();
    await propertyRegistry.grantRole(REGISTRAR_ROLE, await ownershipRegistry.getAddress());

    // 3. Deploy TransactionManager
    const TransactionManager = await ethers.getContractFactory("TransactionManager");
    transactionManager = await TransactionManager.deploy(admin.address, await ownershipRegistry.getAddress());
    await transactionManager.waitForDeployment();

    // Grant roles on TransactionManager
    const VERIFIER_ROLE = await transactionManager.VERIFIER_ROLE();
    const LEGAL_AUTHORITY_ROLE = await transactionManager.LEGAL_AUTHORITY_ROLE();
    const OPERATOR_ROLE = await transactionManager.OPERATOR_ROLE();

    await transactionManager.grantRole(VERIFIER_ROLE, verifier.address);
    await transactionManager.grantRole(LEGAL_AUTHORITY_ROLE, legalAuthority.address);
    await transactionManager.grantRole(OPERATOR_ROLE, operator.address);

    // Grant TRANSFER_ROLE on OwnershipRegistry to TransactionManager
    const TRANSFER_ROLE = await ownershipRegistry.TRANSFER_ROLE();
    await ownershipRegistry.grantRole(TRANSFER_ROLE, await transactionManager.getAddress());
    await ownershipRegistry.grantRole(TRANSFER_ROLE, operator.address);
  });

  describe("PropertyRegistry", function () {
    it("should allow authorized registrar to register a property and emit event", async function () {
      await expect(
        propertyRegistry.connect(admin).registerProperty(propId1, seller.address, sampleDocHash)
      )
        .to.emit(propertyRegistry, "PropertyRegistered")
        .withArgs(propId1, seller.address, sampleDocHash, (val) => val > 0);

      const prop = await propertyRegistry.getProperty(propId1);
      expect(prop.currentOwner).to.equal(seller.address);
      expect(prop.documentHash).to.equal(sampleDocHash);
      expect(prop.exists).to.be.true;
    });

    it("should reject duplicate property registration", async function () {
      await propertyRegistry.connect(admin).registerProperty(propId1, seller.address, sampleDocHash);

      await expect(
        propertyRegistry.connect(admin).registerProperty(propId1, buyer.address, sampleDocHash)
      ).to.be.revertedWithCustomError(propertyRegistry, "PropertyAlreadyRegistered");
    });

    it("should reject registration from unauthorized caller", async function () {
      await expect(
        propertyRegistry.connect(stranger).registerProperty(propId2, stranger.address, sampleDocHash)
      ).to.be.reverted;
    });
  });

  describe("OwnershipRegistry", function () {
    beforeEach(async function () {
      await propertyRegistry.connect(admin).registerProperty(propId1, seller.address, sampleDocHash);
    });

    it("should record initial ownership and retrieve history", async function () {
      await expect(
        ownershipRegistry.connect(operator).recordInitialOwnership(propId1, seller.address)
      )
        .to.emit(ownershipRegistry, "InitialOwnershipRecorded")
        .withArgs(propId1, seller.address, (val) => val > 0);

      const current = await ownershipRegistry.getCurrentOwner(propId1);
      expect(current).to.equal(seller.address);

      const history = await ownershipRegistry.getOwnershipHistory(propId1);
      expect(history.length).to.equal(1);
      expect(history[0].previousOwner).to.equal(ethers.ZeroAddress);
      expect(history[0].newOwner).to.equal(seller.address);
      expect(history[0].transactionId).to.equal("GENESIS");
    });

    it("should reject duplicate initial ownership recording", async function () {
      await ownershipRegistry.connect(operator).recordInitialOwnership(propId1, seller.address);
      await expect(
        ownershipRegistry.connect(operator).recordInitialOwnership(propId1, buyer.address)
      ).to.be.revertedWithCustomError(ownershipRegistry, "InitialOwnershipAlreadyRecorded");
    });
  });

  describe("TransactionManager Workflow", function () {
    const saleAmount = ethers.parseEther("50.0");

    beforeEach(async function () {
      // Setup property and genesis ownership
      await propertyRegistry.connect(admin).registerProperty(propId1, seller.address, sampleDocHash);
      await ownershipRegistry.connect(operator).recordInitialOwnership(propId1, seller.address);

      // Create transaction
      await transactionManager
        .connect(operator)
        .createTransaction(txnId1, propId1, buyer.address, seller.address, saleAmount);
    });

    it("should enforce sequential multi-stakeholder gates and complete conveyance", async function () {
      // Verify initial state
      let txn = await transactionManager.getTransaction(txnId1);
      expect(txn.sellerAccepted).to.be.false;
      expect(txn.documentsVerified).to.be.false;
      expect(txn.legallyConfirmed).to.be.false;

      // Cannot skip to documents approval before seller acceptance
      await expect(
        transactionManager.connect(verifier).approveDocuments(txnId1)
      ).to.be.revertedWithCustomError(transactionManager, "PrerequisitesNotMet");

      // Step 1: Seller accepts
      await expect(transactionManager.connect(seller).acceptTransaction(txnId1))
        .to.emit(transactionManager, "TransactionAccepted")
        .withArgs(txnId1, seller.address, (val) => val > 0);

      // Cannot skip to legal confirmation before document verification
      await expect(
        transactionManager.connect(legalAuthority).confirmLegalRegistration(txnId1)
      ).to.be.revertedWithCustomError(transactionManager, "PrerequisitesNotMet");

      // Step 2: Verifier approves documents
      await expect(transactionManager.connect(verifier).approveDocuments(txnId1))
        .to.emit(transactionManager, "TransactionDocumentsVerified")
        .withArgs(txnId1, verifier.address, (val) => val > 0);

      // Step 3: Legal Authority confirms statutory registration
      await expect(transactionManager.connect(legalAuthority).confirmLegalRegistration(txnId1))
        .to.emit(transactionManager, "TransactionLegallyConfirmed")
        .withArgs(txnId1, legalAuthority.address, (val) => val > 0);

      // Step 4: Complete blockchain execution
      await expect(transactionManager.connect(operator).completeTransfer(txnId1))
        .to.emit(transactionManager, "TransactionCompleted")
        .withArgs(txnId1, propId1, buyer.address, (val) => val > 0);

      // Verify final ownership on both registries
      const newOwner = await ownershipRegistry.getCurrentOwner(propId1);
      expect(newOwner).to.equal(buyer.address);

      const propOnChain = await propertyRegistry.getProperty(propId1);
      expect(propOnChain.currentOwner).to.equal(buyer.address);

      const history = await ownershipRegistry.getOwnershipHistory(propId1);
      expect(history.length).to.equal(2);
      expect(history[1].previousOwner).to.equal(seller.address);
      expect(history[1].newOwner).to.equal(buyer.address);
      expect(history[1].transactionId).to.equal(txnId1);
    });

    it("should allow cancellation by authorized party", async function () {
      await expect(transactionManager.connect(seller).cancelTransaction(txnId1, "Buyer changed terms"))
        .to.emit(transactionManager, "TransactionCancelled")
        .withArgs(txnId1, "Buyer changed terms", (val) => val > 0);
    });
  });
});

