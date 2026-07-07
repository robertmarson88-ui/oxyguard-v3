$ErrorActionPreference = "Stop"

Set-Location $PSScriptRoot
$python = "C:\Users\twcl.ssa\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"

Write-Host "Installing FastAPI backend requirements..." -ForegroundColor Cyan
& $python -m pip install -r requirements.txt

Write-Host ""
Write-Host "Starting OxyGuard FastAPI backend..." -ForegroundColor Cyan
Write-Host "Health check: http://localhost:8000/api/v1/health" -ForegroundColor Yellow
Write-Host ""

& $python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
