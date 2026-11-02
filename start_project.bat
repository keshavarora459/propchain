@echo off
echo ====================================================
echo Starting PropChain Full Stack Platform...
echo ====================================================

:: 1. Start Hardhat Blockchain Node in a new window
start "PropChain - Blockchain Node (Port 8545)" cmd /k "cd /d "%~dp0blockchain" && npx hardhat node"

:: Give node 3 seconds to spin up, then deploy contracts
timeout /t 3 /nobreak >nul
start "PropChain - Deploy Smart Contracts" cmd /c "cd /d "%~dp0blockchain" && npx hardhat run scripts/deploy.js --network localhost && timeout /t 3 >nul"

:: 2. Start FastAPI Backend in a new window
start "PropChain - Backend API (Port 8000)" cmd /k "cd /d "%~dp0backend" && .venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

:: 3. Start Vite Frontend in a new window
start "PropChain - Frontend (Port 5173)" cmd /k "cd /d "%~dp0frontend" && npm run dev"

echo.
echo All services launched!
echo - Frontend:   http://localhost:5173
echo - Backend:    http://127.0.0.1:8000
echo - Swagger UI: http://127.0.0.1:8000/docs
echo - Blockchain: http://127.0.0.1:8545
echo ====================================================
pause

