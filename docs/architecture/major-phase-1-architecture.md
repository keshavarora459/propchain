# PropChain Major Phase 1: Core Platform & Blockchain Architecture

## 1. System Overview
PropChain Major Phase 1 implements an end-to-end decentralized real estate ownership, document verification, and transaction management platform. The platform harmonizes off-chain high-performance relational storage in PostgreSQL with on-chain tamper-evident conveyance verification on an EVM-compatible blockchain.

## 2. Component Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       Frontend (React 19 + TypeScript + Vite)               │
│   - Property Listing, Registration & Details                                │
│   - Document Ingestion, OCR Preview & Auditor Review                        │
│   - MetaMask EIP-191 Challenge Signing & Wallet Linking (ethers.js v6)      │
│   - Real Estate Transaction Lifecycle & Stakeholder Approvals Inbox         │
│   - Tamper-Evident Ownership Ledger Explorer                                │
└──────────────────────────────────────┬──────────────────────────────────────┘
                                       │ Axios HTTP / JWT Auth
                                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                       Backend API (FastAPI + Python 3.11)                   │
│   - Property Management Service & Duplicate Prevention                      │
│   - Document Service (PyMuPDF Extraction, SHA-256 Hashing, AES Encryption)  │
│   - Wallet Verification Service (EIP-191 recover_message)                   │
│   - Transaction State Machine (13 Explicit Lifecycle Gates)                 │
│   - Stakeholder Approval Engine & Legal Authority Confirmation Filter       │
│   - Blockchain Service (web3.py + Dual-State PostgreSQL Synchronization)    │
└───────────────────────┬─────────────────────────────┬───────────────────────┘
                        │                             │
                        ▼                             ▼
┌──────────────────────────────────┐        ┌─────────────────────────────────┐
│     PostgreSQL Database Engine   │        │     Hardhat Local EVM Node      │
│  - properties                    │        │  - Chain ID: 31337              │
│  - property_documents            │        │  - PropertyRegistry.sol         │
│  - document_processing_records   │        │  - OwnershipRegistry.sol        │
│  - document_verification_records │        │  - TransactionManager.sol       │
│  - user_wallets                  │        │                                 │
│  - blockchain_operations         │        │                                 │
│  - blockchain_events             │        │                                 │
│  - ownership_events              │        │                                 │
│  - property_transactions         │        │                                 │
│  - transaction_status_history    │        │                                 │
│  - transaction_approvals         │        │                                 │
│  - legal_registration_confirmations       │                                 │
└──────────────────────────────────┘        └─────────────────────────────────┘
```

## 3. The 13-State Transaction Lifecycle
1. `DRAFT`: Proposal prepared.
2. `INITIATED`: Submitted by Buyer.
3. `PENDING_SELLER_ACCEPTANCE`: Waiting for Seller response.
4. `PENDING_DOCUMENT_VERIFICATION`: Waiting for Title Verifier review.
5. `PENDING_APPROVALS`: Stakeholder review in progress.
6. `READY_FOR_LEGAL_CONFIRMATION`: Title cleared, waiting for Legal Authority.
7. `LEGALLY_REGISTERED`: Statutory registration confirmed by Legal Authority.
8. `READY_FOR_BLOCKCHAIN_EXECUTION`: Prerequisites satisfied for smart contract.
9. `BLOCKCHAIN_PENDING`: Transaction submitted to EVM node.
10. `COMPLETED`: Receipt confirmed, ownership ledger updated.
11. `REJECTED`: Rejected by seller or verifier.
12. `CANCELLED`: Withdrawn by buyer or seller.
13. `FAILED`: Technical or on-chain execution error.

