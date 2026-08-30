# QuasarOS Local Full-Stack Launcher
# Starts Backend (FastAPI on 127.0.0.1:8000) and Frontend (Vite on 127.0.0.1:5173)

$backendPath = Join-Path (Get-Location).Path "packages/services/src"
$contractsPath = Join-Path (Get-Location).Path "packages/contracts/src"
$env:PYTHONPATH = "$backendPath;$contractsPath;$env:PYTHONPATH"

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "        Launching QuasarOS v1.1.0 Full-Stack           " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "1. Starting FastAPI backend on http://127.0.0.1:8000..." -ForegroundColor Green
$b = Start-Process python -ArgumentList "-m uvicorn quasar_services.app:app --host 127.0.0.1 --port 8000 --reload" -PassThru

Write-Host "2. Starting Vite frontend on http://127.0.0.1:5173..." -ForegroundColor Green
$f = Start-Process cmd.exe -ArgumentList "/c npx vite --host 127.0.0.1 --port 5173" -WorkingDirectory "apps/web" -PassThru

Write-Host "Services started successfully!" -ForegroundColor Yellow
Write-Host "Backend PID:  $($b.Id) (http://127.0.0.1:8000)"
Write-Host "Frontend PID: $($f.Id) (http://127.0.0.1:5173)"
Write-Host "API Docs:     http://127.0.0.1:8000/docs"
Write-Host "To stop services: Stop-Process -Id $($b.Id), $($f.Id)"
