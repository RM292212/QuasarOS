# QuasarOS Local Full-Stack Launcher
# Starts Backend (FastAPI on 127.0.0.1:8000) and Frontend (Vite on 127.0.0.1:5173) in dedicated interactive windows

$root = (Get-Location).Path
$backendPath = Join-Path $root "packages\services\src"
$contractsPath = Join-Path $root "packages\contracts\src"

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "        Launching QuasarOS v1.1.0 Full-Stack           " -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

# 1. Start FastAPI Backend in new window (with -NoExit so it never closes if there is any message)
Write-Host "1. Launching Backend Window (http://127.0.0.1:8000)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host 'Starting QuasarOS FastAPI Backend...' -ForegroundColor Cyan; `$env:PYTHONPATH = '$backendPath;$contractsPath'; python -m uvicorn quasar_services.app:app --host 127.0.0.1 --port 8000 --reload"

# 2. Start Vite Frontend in new window (with -NoExit)
Write-Host "2. Launching Frontend Window (http://127.0.0.1:5173)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host 'Starting QuasarOS Vite Frontend...' -ForegroundColor Cyan; Set-Location '$root\apps\web'; npx vite --host 127.0.0.1 --port 5173"

Write-Host ""
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "Both Backend & Frontend windows have been launched!" -ForegroundColor Green
Write-Host "  • Frontend Web App:     http://127.0.0.1:5173" -ForegroundColor Yellow
Write-Host "  • FastAPI Backend:      http://127.0.0.1:8000" -ForegroundColor Yellow
Write-Host "  • Swagger/OpenAPI Docs: http://127.0.0.1:8000/docs" -ForegroundColor Yellow
Write-Host "  • Health Liveness:      http://127.0.0.1:8000/health/live" -ForegroundColor Yellow
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "To stop the stack: powershell -ExecutionPolicy Bypass -File scripts\stop_local_stack.ps1" -ForegroundColor Gray
