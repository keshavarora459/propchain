# PropChain One-Click Launch Script
Write-Host "====================================================" -ForegroundColor Cyan
Write-Host "Starting PropChain Full Stack Platform..." -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan

$root = $PSScriptRoot

# 1. Start Blockchain Node
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root\blockchain'; npx hardhat node"

Start-Sleep -Seconds 3

# Deploy Contracts
Start-Process powershell -ArgumentList "-Command", "Set-Location '$root\blockchain'; npx hardhat run scripts/deploy.js --network localhost; Start-Sleep -Seconds 3"

# 2. Start Backend API
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root\backend'; .\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload"

# 3. Start Frontend Dev Server
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$root\frontend'; npm run dev"

Write-Host "`nAll PropChain services launched in separate windows!" -ForegroundColor Green
Write-Host "- Frontend Web UI:  http://localhost:5173" -ForegroundColor Yellow
Write-Host "- Backend API:       http://127.0.0.1:8000" -ForegroundColor Yellow
Write-Host "- Swagger API Docs:  http://127.0.0.1:8000/docs" -ForegroundColor Yellow
Write-Host "- Blockchain RPC:    http://127.0.0.1:8545" -ForegroundColor Yellow
Write-Host "====================================================" -ForegroundColor Cyan

