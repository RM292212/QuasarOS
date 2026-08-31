# QuasarOS Local Full-Stack Stopper — RUNTIME-STABILITY-04
# Safely stops all backend and frontend processes, freeing ports 8000 and 5173

Write-Host "Stopping QuasarOS local stack..." -ForegroundColor Cyan

# 1. Kill processes bound to ports 8000 and 5173
$ports = @(8000, 5173)
foreach ($p in $ports) {
    $netstat = Get-NetTCPConnection -LocalPort $p -ErrorAction SilentlyContinue
    if ($netstat) {
        foreach ($conn in $netstat) {
            $pidToKill = $conn.OwningProcess
            if ($pidToKill -gt 0) {
                Write-Host "  Terminating process on port $p (PID: $pidToKill)..." -ForegroundColor Yellow
                Stop-Process -Id $pidToKill -Force -ErrorAction SilentlyContinue
            }
        }
    }
}

# 2. Clean matching process names
Get-Process python, node, npx, cmd, powershell -ErrorAction SilentlyContinue | Where-Object { 
    $_.MainWindowTitle -match "QuasarOS" -or 
    $_.CommandLine -match "quasar" -or 
    $_.CommandLine -match "uvicorn" -or 
    $_.CommandLine -match "vite" 
} | Stop-Process -Force -ErrorAction SilentlyContinue

Write-Host "âœ“ QuasarOS local stack stopped cleanly. Ports 8000 and 5173 released." -ForegroundColor Green
