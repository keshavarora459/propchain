# PropChain — Blockchain Real Estate Ownership & Transaction Platform

[![Phase](https://img.shields.io/badge/Phase-1%20Foundation-blue.svg)](#current-development-status)
[![Node](https://img.shields.io/badge/Node.js-v22.20.0-green.svg)](https://nodejs.org/)
[![Python](https://img.shields.io/badge/Python-3.11.9-blue.svg)](https://www.python.org/)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.28-black.svg)](https://soliditylang.org/)

---

## 1. Project Overview

**PropChain** is a decentralized, blockchain-based real estate platform designed to bring cryptographic transparency, title immutability, and automated verification to real estate property ownership and transfer. Incorporating artificial intelligence for automated deed document analysis and anomaly detection, PropChain bridges traditional real estate legal processes with modern Ethereum Virtual Machine (EVM) smart contract execution.

---

## 2. Problem Statement

Traditional real estate transactions face significant challenges:
- **Title Fraud & Forgery:** Paper deeds and centralized land registries are vulnerable to fraudulent conveyance, unauthorized mortgage encumbrances, and identity theft.
- **Protracted Escrow & Closing:** Closing a property sale often takes weeks due to manual title searches, escrow intermediaries, and document re-checking.
- **Fragmented Systems:** Public records, surveyor reports, title insurance firms, and banking institutions operate in disconnected data silos with no single source of truth.
- **High Friction & Intermediary Fees:** High escrow and administrative costs are burdened onto buyers and sellers.

---

## 3. Proposed Solution

PropChain addresses these challenges through a unified technological architecture:
- **EVM-Based Digital Property Titles:** Representing parcel deeds as cryptographically provable digital assets on an Ethereum-compatible blockchain.
- **Smart Contract Escrow & Settlement:** Automating deed transfer upon atomic verification of funds and seller/buyer stipulations.
- **AI-Powered Document Verification:** PyMuPDF and Tesseract OCR document extraction integrated with Scikit-learn fraud scoring models to detect tampered deeds before title minting.
- **Hybrid Off-Chain / On-Chain Architecture:** Off-chain private records and heavy files stored securely in PostgreSQL and encrypted object storage, while cryptographic proof hashes and ownership states remain immutable on-chain.

---

## 4. Final Technology Stack

| Layer | Technology | Version / Tooling |
|---|---|---|
| **Frontend** | React.js + TypeScript + Vite | React 19, TypeScript 7.0, Vite 8.3 |
| **Styling** | Tailwind CSS | Phase 2 implementation |
| **Backend** | Python + FastAPI | Python 3.11, FastAPI 0.115, Uvicorn 0.32 |
| **Database** | PostgreSQL | PostgreSQL + `psycopg` driver |
| **ORM & Migrations** | SQLAlchemy & Alembic | Python ORM & versioned schema migrations |
| **Blockchain** | Ethereum-compatible EVM | Solidity `^0.8.28`, Hardhat 2.22 |
| **Blockchain Integration** | ethers.js & Web3.py | Node & Python RPC clients |
| **Wallet** | MetaMask | Browser-based Web3 wallet |
| **Document Processing** | PyMuPDF + Tesseract OCR | PDF structural extraction + OCR |
| **AI Fraud Detection** | Python + Scikit-learn | ML classification and anomaly detection |
| **File Storage** | Local Storage / Encrypted Object Storage | Local `storage/uploads` initially |
| **API Testing** | Postman / Pytest | Test-driven API verification |
| **Version Control** | Git + GitHub | Local monorepo version control |

---

## 5. High-Level Architecture

```
[ Client: React + TypeScript + Vite + ethers.js ]
                  │
          REST / JSON HTTPS
                  ▼
[ Backend: FastAPI Gateway Service (Python 3.11) ]
     │                 │                    │
     ▼                 ▼                    ▼
[ PostgreSQL ]  [ AI & OCR Engine ]   [ EVM Blockchain ]
(Off-chain DB)  (PyMuPDF + Tesseract) (Hardhat / Solidity)
```

For full architectural blueprints, see [`docs/architecture/system-overview.md`](docs/architecture/system-overview.md).

---

## 6. Project Directory Structure

```text
propchain/
├── frontend/                     # React + TypeScript + Vite frontend client
│   ├── src/                      # UI components and client logic
│   ├── package.json              # Frontend npm dependencies
│   ├── vite.config.ts            # Vite build configuration
│   └── .env.example              # Frontend environment template
│
├── backend/                      # FastAPI Python backend service
│   ├── app/                      # Application source package
│   │   ├── api/                  # REST API routes and endpoints
│   │   ├── core/                 # App configuration and security
│   │   ├── models/               # SQLAlchemy ORM models
│   │   ├── schemas/              # Pydantic request/response schemas
│   │   ├── services/             # Business logic layer
│   │   └── utils/                # Helper utilities
│   ├── tests/                    # Pytest test suite
│   ├── scripts/                  # Backend utility scripts
│   ├── requirements.txt          # Python dependencies
│   └── .venv/                    # Python virtual environment (ignored)
│
├── blockchain/                   # Solidity smart contracts workspace
│   ├── contracts/                # Solidity contract files (.sol)
│   ├── scripts/                  # Deployment and test scripts
│   ├── test/                     # Contract test suite
│   ├── deployments/              # Deployment artifact records
│   ├── hardhat.config.js         # Hardhat configuration
│   └── package.json              # Blockchain dependencies
│
├── ai/                           # AI fraud detection engine
│   ├── models/                   # Serialized ML model artifacts
│   ├── preprocessing/            # Feature extraction and OCR pipelines
│   ├── training/                 # Model training scripts
│   ├── inference/                # Real-time risk scoring modules
│   └── tests/                    # AI pipeline unit tests
│
├── storage/                      # Document and media storage
│   ├── uploads/                  # Raw document uploads
│   ├── processed/                # Extracted text & parsed records
│   └── temporary/                # Temporary processing buffer
│
├── docs/                         # Project documentation
│   ├── architecture/             # System diagrams and architecture specs
│   ├── api/                      # OpenAPI / REST documentation
│   ├── blockchain/               # Smart contract documentation
│   └── development/              # Setup guides and phase logs
│
├── scripts/                      # Project-wide operations & CI scripts
├── .gitignore                    # Git exclusions
├── .editorconfig                 # Multi-editor code formatting standards
├── .env.example                  # Root environment template
└── README.md                     # Main documentation entrypoint
```

---

## 7. Local Development Requirements

- **Operating System:** Windows 10/11 (PowerShell environment)
- **Node.js:** v18.0.0+ (Tested with v22.20.0)
- **npm:** v9.0.0+ (Tested with 10.9.3)
- **Python:** 3.10+ (Tested with Python 3.11.9)
- **Git:** 2.30+ (Tested with 2.55.0)
- **PostgreSQL:** 15+ (Required from Phase 4)
- **Tesseract OCR:** 5.0+ (Required from Phase 11)

---

## 8. Installation Instructions

### Clone / Enter Directory
Ensure the project is located in `Z:\aosc\propchain`:
```powershell
cd Z:\aosc\propchain
```

### Backend Virtual Environment Setup
```powershell
cd Z:\aosc\propchain\backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
```

### Frontend Dependencies Setup
```powershell
cd Z:\aosc\propchain\frontend
npm install
```

### Blockchain Workspace Setup
```powershell
cd Z:\aosc\propchain\blockchain
npm install
```

---

## 9. Environment Configuration Instructions

Copy the template files to create local environment configurations:

```powershell
# In project root
Copy-Item .env.example .env

# In frontend directory
Copy-Item frontend\.env.example frontend\.env
```

> **IMPORTANT:** Never commit `.env` files, private keys, or wallet seed phrases to version control.

---

## 10. Frontend Startup Commands

To start the Vite development server on port 5173:
```powershell
cd Z:\aosc\propchain\frontend
npm run dev
```

To produce a production build:
```powershell
cd Z:\aosc\propchain\frontend
npm run build
```

---

## 11. Backend Startup Commands

To run the FastAPI backend development server on port 8000:
```powershell
cd Z:\aosc\propchain\backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```

To run backend tests:
```powershell
cd Z:\aosc\propchain\backend
.\.venv\Scripts\pytest.exe
```

---

## 12. Blockchain Workspace Information

The blockchain environment is initialized with Hardhat and configured for local Ethereum simulation:
- **Default Network:** Local Hardhat Network (`chainId: 31337`)
- **Solidity Version:** `0.8.28`
- **Compiler Optimizations:** Enabled (200 runs)
- **No Real Assets:** No real cryptocurrency or mainnet connections are configured.

---

## 13. Development Phases

- **Phase 1: Project Foundation & Environment Setup** *(Completed)*
- **Phase 2: Frontend Architecture & UI Framework** *(Next)*
- **Phase 3: Backend Architecture & Authentication**
- **Phase 4: Database Modeling & Migrations**
- **Phase 5: Property Registration Workflow**
- **Phase 6: Document Upload & Storage Pipeline**
- **Phase 7: Smart Contract Development & Testing**
- **Phase 8: Web3 Integration & Wallet Connection**
- **Phase 9: Ownership Transfer & Escrow Management**
- **Phase 10: Real-Time Notifications & Event Subscriptions**
- **Phase 11: Document Parsing & OCR Pipeline**
- **Phase 12: AI Fraud Detection Engine**
- **Phase 13: End-to-End System Integration**
- **Phase 14: Security Audits & Vulnerability Testing**
- **Phase 15: Performance Optimization & DevOps**
- **Phase 16: Deployment & Final Release**

---

## 14. Security Considerations

- **Strict Secret Isolation:** All sensitive credentials, database connection strings, and JWT secrets are stored solely in `.env` files excluded by `.gitignore`.
- **Zero Committed Private Keys:** No Ethereum private keys or mnemonic seed phrases are generated or stored in the repository.
- **Client-Side Sanitization:** Frontend environment variables are strictly limited to `VITE_`-prefixed non-sensitive configurations.
- **Isolation of Adjacent Projects:** The workspace is strictly contained inside `Z:\aosc\propchain`, preventing any interference with existing external projects.

---

## 15. Current Development Status

- **Current Phase:** Phase 1 (Project Foundation & Environment Setup) — **COMPLETE**
- **Next Phase:** Phase 2 (Frontend Architecture)
- **Status Summary:** All Phase 1 directory structures, Python virtual environment, FastAPI health service, React+TS frontend foundation, and Hardhat blockchain configuration have been built, verified, and validated.

