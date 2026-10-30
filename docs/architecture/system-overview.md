# PropChain — System Architecture & Component Overview

## 1. Executive Summary

**PropChain** is an institutional-grade, decentralized platform engineered to modernize real estate title management, escrow transactions, and document verification. By integrating Ethereum-compatible smart contracts with an AI-driven document audit pipeline, PropChain provides immutable ownership records, cryptographically verifiable deed transfers, and automated fraud prevention.

---

## 2. High-Level Architecture

The PropChain ecosystem follows a decoupled, multi-tier architectural pattern where client presentation, business orchestration, persistent storage, off-chain machine intelligence, and decentralized consensus interact through secure, well-defined boundaries.

```
+-------------------------------------------------------------------------+
|                              PRESENTATION LAYER                         |
|           React.js + TypeScript + Vite + Tailwind CSS (SPA)             |
|                 MetaMask / Web3 Wallet Browser Extension                |
+------------------------------------+------------------------------------+
                                     |
                                     | HTTPS / JSON / REST
                                     v
+-------------------------------------------------------------------------+
|                              ORCHESTRATION LAYER                        |
|                         Python FastAPI Gateway Service                  |
|          Authentication (JWT) | Schema Validation (Pydantic)            |
+-------------------+--------------------+-------------------+------------+
                    |                    |                   |
                    | SQLAlchemy         | IPC / Task Queue  | Web3.py
                    v                    v                   v
+-------------------+---+  +-------------+----+  +------------+------------+
|   PERSISTENCE LAYER   |  |   INTELLIGENCE   |  |     CONSENSUS LAYER    |
|   PostgreSQL + Alembic|  |   OCR & ML Pipeline | EVM-Compatible Network |
|                       |  |                  |  | (Hardhat / Ethereum)   |
| - Off-chain Metadata  |  | - PyMuPDF Text   |  |                        |
| - User Profiles       |  | - Tesseract OCR  |  | - PropertyRegistry.sol |
| - Audit Trail Logs    |  | - Scikit-learn   |  | - OwnershipRegistry.sol|
| - Storage Pointers    |  |   Fraud Detector |  | - TransactionManager   |
+-----------------------+  +------------------+  +------------------------+
```

---

## 3. Component Breakdown & Responsibilities

### 3.1. Frontend Client (Presentation Layer)
- **Framework:** React 19, TypeScript, Vite.
- **Styling:** Tailwind CSS (configured in Phase 2).
- **Web3 Interface:** `ethers.js` connecting to user wallets (MetaMask).
- **Responsibilities:**
  - Client-side navigation, title explorer, and deed upload interface.
  - Direct wallet signature requests for on-chain state changes.
  - Consuming REST endpoints from the FastAPI backend.

### 3.2. Backend API (Application Layer)
- **Framework:** FastAPI, Python 3.11, Uvicorn (ASGI).
- **Responsibilities:**
  - Serving REST API endpoints for user management, document submission, and health checks.
  - Orchestrating document ingestion and off-chain storage workflows.
  - Coordinating between database queries, AI evaluation services, and blockchain verification queries.
  - Relaying contract events and maintaining indexed search capabilities.

### 3.3. Persistence Layer (Relational Storage)
- **Database:** PostgreSQL with `psycopg` driver.
- **ORM / Migrations:** SQLAlchemy and Alembic.
- **Responsibilities:**
  - Storing off-chain metadata (user KYC records, property descriptions, deed hashes).
  - Transaction logs and AI fraud scoring histories.
  - Providing fast relational queries without placing unbounded metadata onto the blockchain.

### 3.4. Document Processing & AI Fraud Detection Engine (Intelligence Layer)
- **Document Ingestion:** PyMuPDF (PDF structural parsing) and Tesseract OCR (optical character extraction).
- **Fraud Analysis:** Python Scikit-learn anomaly detection and feature classifiers.
- **Responsibilities:**
  - Parsing uploaded title deeds, surveys, and identification documents.
  - Cross-verifying document text against registered public records and registry inputs.
  - Generating fraud confidence scores and risk flags before contract minting or transfers.

### 3.5. Smart Contracts & Blockchain (Consensus Layer)
- **Language / Environment:** Solidity `^0.8.28`, Hardhat EVM.
- **Integration:** Web3.py (backend) and ethers.js (frontend).
- **Core Planned Contracts:**
  1. `PropertyRegistry.sol`: ERC-721 based non-fungible digital representation of real estate parcel titles.
  2. `OwnershipRegistry.sol`: Granular tracking of historical ownership, encumbrances, and verified claims.
  3. `TransactionManager.sol`: Escrow and atomic settlement logic coordinating buyers, sellers, and title verifiers.

---

## 4. Implementation Status Matrix

| Component | Status | Phase Scheduled | Notes |
|---|---|---|---|
| Monorepo & Directory Layout | **IMPLEMENTED** | Phase 1 | Clean root separation for backend, frontend, blockchain, ai, storage, docs |
| Python Virtual Environment | **IMPLEMENTED** | Phase 1 | `backend/.venv` with Python 3.11.9, pinned FastAPI & Pytest |
| FastAPI Health Check API | **IMPLEMENTED** | Phase 1 | Endpoint `/api/health` verified with automated test suite |
| Frontend Foundation | **IMPLEMENTED** | Phase 1 | React + TypeScript + Vite initialized, build and dev server validated |
| Blockchain Workspace | **IN PROGRESS** | Phase 1 | Hardhat workspace initialized, configured for local EVM chainId 31337 |
| Environment Configurations | **IMPLEMENTED** | Phase 1 | Root `.env.example` and `frontend/.env.example` templates established |
| Frontend Architecture & Design | Planned | Phase 2 | Tailwind CSS styling, component hierarchy, design tokens |
| Backend Architecture & Auth | Planned | Phase 3 | User models, JWT security, password hashing |
| PostgreSQL & Database Models | Planned | Phase 4 | SQLAlchemy schema, Alembic migration scripts |
| Smart Contracts Implementation| Planned | Phase 7 | Solidity contracts for title registration and escrow |
| Web3 Integration | Planned | Phase 8 | ethers.js & Web3.py RPC orchestration |
| Document Ingestion & OCR | Planned | Phase 11 | PyMuPDF parsing and Tesseract OCR text extraction |
| AI Fraud Detection | Planned | Phase 12 | Scikit-learn risk scoring pipelines |

---

## 5. Security & Boundary Rules

1. **Private Keys & Secrets:** Private keys, seed phrases, and environment credentials MUST NEVER be checked into version control. Local `.env` files are excluded via `.gitignore`.
2. **Decoupled Architecture:** No backend secret is ever bundled into frontend builds. All frontend parameters must be public-safe and prefixed with `VITE_`.
3. **Off-Chain vs. On-Chain Separation:** Heavy binary documents, high-volume telemetry, and machine learning models remain strictly off-chain; only cryptographic hashes (SHA-256 / Keccak-256) and verified token states are anchored to the blockchain.

