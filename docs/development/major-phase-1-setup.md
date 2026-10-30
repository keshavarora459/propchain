# PropChain Major Phase 1 Setup & Run Guide

## 1. Environment Requirements
- Windows 10/11 with PowerShell
- Python 3.11+
- Node.js 18+
- Hardhat 2.22+

## 2. Starting the Services

### Terminal 1: Local Blockchain (Hardhat EVM Node)
```powershell
cd "C:\Users\Kesha\Desktop\Real estate Block chain\aosc\propchain\blockchain"
npx hardhat node
```
*Listens on `http://127.0.0.1:8545` (Chain ID: 31337).*

### Terminal 2: Smart Contract Deployment
```powershell
cd "C:\Users\Kesha\Desktop\Real estate Block chain\aosc\propchain\blockchain"
npx hardhat run scripts\deploy.js --network localhost
```

### Terminal 3: Backend API (FastAPI)
```powershell
cd "C:\Users\Kesha\Desktop\Real estate Block chain\aosc\propchain\backend"
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
*Listens on `http://127.0.0.1:8000`. Interactive docs at `/docs`.*

### Terminal 4: Frontend Development Server (Vite)
```powershell
cd "C:\Users\Kesha\Desktop\Real estate Block chain\aosc\propchain\frontend"
npm run dev -- --host 127.0.0.1 --port 5173
```
*Listens on `http://127.0.0.1:5173`.*

## 3. Running Automated Tests

### Backend Unit & Integration Tests (Pytest)
```powershell
cd "C:\Users\Kesha\Desktop\Real estate Block chain\aosc\propchain\backend"
.\.venv\Scripts\pytest.exe
```

### Smart Contract Test Suite (Hardhat)
```powershell
cd "C:\Users\Kesha\Desktop\Real estate Block chain\aosc\propchain\blockchain"
npx hardhat test
```

### Frontend Typecheck & Build
```powershell
cd "C:\Users\Kesha\Desktop\Real estate Block chain\aosc\propchain\frontend"
npm run build
```

