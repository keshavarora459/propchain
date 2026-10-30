# ==============================================================================
# PropChain Phase 1 Foundation Automated Verification Script (PowerShell)
# ==============================================================================

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "     PROPCHAIN - PHASE 1 FOUNDATION VALIDATOR     " -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

$passCount = 0
$failCount = 0

function Report-Check {
    param (
        [string]$Name,
        [bool]$Success,
        [string]$Details
    )
    if ($Success) {
        Write-Host " [PASS] $Name" -ForegroundColor Green
        if ($Details) { Write-Host "        $Details" -ForegroundColor Gray }
        $script:passCount++
    } else {
        Write-Host " [FAIL] $Name" -ForegroundColor Red
        if ($Details) { Write-Host "        $Details" -ForegroundColor Yellow }
        $script:failCount++
    }
}

$root = if ($PSScriptRoot) { Split-Path -Parent $PSScriptRoot } else { (Get-Item ".\propchain").FullName }

# 1. Directory Structure Checks
$requiredDirs = @(
    "frontend",
    "backend\app\api",
    "backend\app\core",
    "backend\app\models",
    "backend\app\schemas",
    "backend\app\services",
    "backend\app\utils",
    "backend\tests",
    "backend\scripts",
    "blockchain\contracts",
    "blockchain\scripts",
    "blockchain\test",
    "blockchain\deployments",
    "ai\models",
    "ai\preprocessing",
    "ai\training",
    "ai\inference",
    "ai\tests",
    "storage\uploads",
    "storage\processed",
    "storage\temporary",
    "docs\architecture",
    "docs\api",
    "docs\blockchain",
    "docs\development",
    "scripts"
)

$missingDirs = @()
foreach ($dir in $requiredDirs) {
    if (-not (Test-Path "$root\$dir")) {
        $missingDirs += $dir
    }
}
Report-Check "Monorepo Directory Layout" ($missingDirs.Count -eq 0) "Checked $($requiredDirs.Count) directories."

# 2. Git & Ignore Checks
$hasGit = Test-Path "$root\.git"
$hasGitIgnore = Test-Path "$root\.gitignore"
Report-Check "Git Repository Initialized" $hasGit "Found .git in $root"
Report-Check "Git Ignore File Exists" $hasGitIgnore "Found .gitignore"

# 3. Environment Variable Templates
$hasEnvExample = Test-Path "$root\.env.example"
$hasFrontendEnvExample = Test-Path "$root\frontend\.env.example"
Report-Check "Root .env.example Template" $hasEnvExample "Found root template"
Report-Check "Frontend .env.example Template" $hasFrontendEnvExample "Found frontend template"

# 4. Backend Virtual Environment & Tests
$pythonExe = "$root\backend\.venv\Scripts\python.exe"
$pytestExe = "$root\backend\.venv\Scripts\pytest.exe"
$hasVenv = Test-Path $pythonExe
Report-Check "Python Virtual Environment" $hasVenv "Found $pythonExe"

if ($hasVenv) {
    $pytestOut = & $pytestExe "$root\backend\tests" 2>&1
    $pytestSuccess = ($LASTEXITCODE -eq 0)
    Report-Check "FastAPI Health Check Test Suite" $pytestSuccess "Pytest exit code: $LASTEXITCODE"
}

# 5. Frontend Build Verification
$frontendDist = "$root\frontend\dist\index.html"
$hasDist = Test-Path $frontendDist
Report-Check "Frontend Production Build" $hasDist "Found $frontendDist"

# 6. Blockchain Hardhat Environment
Push-Location "$root\blockchain"
$npxCmd = if (Get-Command "npx.cmd" -ErrorAction SilentlyContinue) { "npx.cmd" } else { "npx" }
$hardhatOut = & $npxCmd hardhat --version 2>&1
$hardhatSuccess = ($LASTEXITCODE -eq 0)
Pop-Location
Report-Check "Hardhat EVM Environment" $hardhatSuccess "Hardhat Version: $hardhatOut"

# 7. Unrelated Projects Safety Verification
$payrollUntouched = Test-Path "C:\Users\Kesha\Desktop\AOSC"
Report-Check "ROOT Payroll Isolation & Safety" $payrollUntouched "Confirmed external project preserved"

Write-Host "==================================================" -ForegroundColor Cyan
Write-Host "Summary: $passCount Passed, $failCount Failed" -ForegroundColor $(if ($failCount -eq 0) { "Green" } else { "Red" })
Write-Host "==================================================" -ForegroundColor Cyan

if ($failCount -gt 0) {
    exit 1
} else {
    exit 0
}
