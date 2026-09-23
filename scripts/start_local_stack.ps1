# QuasarOS Robust Local Full-Stack Orchestrator — RUNTIME-STABILITY-04
# Starts Backend (FastAPI on 127.0.0.1:8000), polls /health/ready with bounded timeout,
# and starts Frontend (Vite on 127.0.0.1:5173) ONLY after backend readiness succeeds.

param(
    [int]$TimeoutSeconds = 90,
    [switch]$NoBrowser
)

$root = (Get-Location).Path
$backendPath = Join-Path $root "packages\services\src"
$contractsPath = Join-Path $root "packages\contracts\src"
$logDir = Join-Path $root "reports\runtime-stability\evidence\logs"
if (-not (Test-Path $logDir)) {
    New-Item -ItemType Directory -Force -Path $logDir | Out-Null
}
$launcherLog = Join-Path $logDir "launcher.log"

function Log-Message([string]$msg, [string]$color = "White") {
    $timestamp = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
    $logLine = "[$timestamp] $msg"
    Write-Host $msg -ForegroundColor $color
    Add-Content -Path $launcherLog -Value $logLine -Encoding UTF8
}

Log-Message "========================================================" "Cyan"
Log-Message "    QuasarOS Robust Full-Stack Launcher (STABILITY-04)   " "Yellow"
Log-Message "========================================================" "Cyan"

# 1. Clean any stale processes on ports 8000 and 5173
Log-Message "[1/4] Checking ports 8000 and 5173..." "Gray"
$ports = @(8000, 5173)
foreach ($p in $ports) {
    try {
        $netstat = Get-NetTCPConnection -LocalPort $p -ErrorAction SilentlyContinue
        if ($netstat) {
            foreach ($conn in $netstat) {
                $pidToKill = $conn.OwningProcess
                if ($pidToKill -gt 0) {
                    Log-Message "  Releasing occupied port $p (PID: $pidToKill)..." "Yellow"
                    Stop-Process -Id $pidToKill -Force -ErrorAction SilentlyContinue
                }
            }
        }
    } catch {
        # Fallback using netstat / taskkill
        $netstatLines = netstat -ano | Select-String ":$p\s+"
        foreach ($line in $netstatLines) {
            $parts = $line.ToString().Trim() -split '\s+'
            $pidToKill = $parts[-1]
            if ($pidToKill -as [int] -and [int]$pidToKill -gt 0) {
                Log-Message "  Force killing port $p owner (PID: $pidToKill)..." "Yellow"
                Stop-Process -Id ([int]$pidToKill) -Force -ErrorAction SilentlyContinue
            }
        }
    }
}
Start-Sleep -Seconds 1

# 2. Launch FastAPI Backend in interactive window
Log-Message "[2/4] Starting FastAPI Backend (http://127.0.0.1:8000)..." "Green"
$backendCmd = "`$env:PYTHONPATH = '$backendPath;$contractsPath'; python -m uvicorn quasar_services.app:app --host 127.0.0.1 --port 8000 --workers 1 --log-level info"
$bProc = Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host '=========================================' -ForegroundColor Cyan; Write-Host '   QuasarOS FastAPI Backend Server' -ForegroundColor Yellow; Write-Host '=========================================' -ForegroundColor Cyan; $backendCmd" -PassThru

Log-Message "  Backend process spawned (PID: $($bProc.Id))." "Gray"

# 3. Poll /health/ready with bounded exponential backoff
Log-Message "[3/4] Waiting for Backend /health/ready probe..." "Cyan"
$startTime = Get-Date
$isReady = $false
$pollDelay = 1.0
$elapsed = 0

while ($elapsed -lt $TimeoutSeconds) {
    Start-Sleep -Seconds $pollDelay
    $elapsed = ((Get-Date) - $startTime).TotalSeconds
    $roundedSec = [Math]::Round($elapsed, 1)

    try {
        $res = Invoke-RestMethod -Uri "http://127.0.0.1:8000/health/ready" -Method Get -TimeoutSec 10 -ErrorAction Stop
        if ($res.status -eq "ok" -or $res.integrityVerified -eq $true) {
            $isReady = $true
            Log-Message "  [OK] Backend is READY (elapsed: ${roundedSec}s)!" "Green"
            break
        } else {
            $st = $res.status
            Log-Message "  ... Backend responding with degraded state ($st), retrying (${roundedSec}s)..." "Yellow"
        }
    } catch {
        Log-Message "  ... Waiting for backend socket to accept connections (${roundedSec}s)..." "Gray"
    }

    $pollDelay = [Math]::Min(3.0, $pollDelay * 1.3)
}

if (-not $isReady) {
    Log-Message "ERROR: Backend failed to report ready within $TimeoutSeconds seconds." "Red"
    Log-Message "Check backend window or logs at reports/runtime-stability/evidence/logs/" "Red"
    exit 1
}

# 4. Start Vite Frontend in new window
Log-Message "[4/4] Starting Vite Frontend (http://127.0.0.1:5173)..." "Green"
$webDir = Join-Path $root "apps\web"
$frontendCmd = "Set-Location '$webDir'; npx vite --host 127.0.0.1 --port 5173"
$fProc = Start-Process powershell -ArgumentList "-NoExit", "-Command", "Write-Host '=========================================' -ForegroundColor Cyan; Write-Host '   QuasarOS Vite Frontend Server' -ForegroundColor Yellow; Write-Host '=========================================' -ForegroundColor Cyan; $frontendCmd" -PassThru

Log-Message "  Frontend process spawned (PID: $($fProc.Id))." "Gray"

Log-Message "" "White"
Log-Message "========================================================" "Cyan"
Log-Message " QuasarOS v1.1.0 Full-Stack is ACTIVE & RUNNING! " "Green"
Log-Message "========================================================" "Cyan"
Log-Message "  - Frontend Web App:     http://127.0.0.1:5173" "Yellow"
Log-Message "  - FastAPI Backend:      http://127.0.0.1:8000" "Yellow"
Log-Message "  - Swagger/OpenAPI Docs: http://127.0.0.1:8000/docs" "Yellow"
Log-Message "  - Liveness Probe:       http://127.0.0.1:8000/health/live" "Yellow"
Log-Message "  - Readiness Probe:      http://127.0.0.1:8000/health/ready" "Yellow"
Log-Message "========================================================" "Cyan"
Log-Message "To stop the stack at any time: powershell -ExecutionPolicy Bypass -File scripts\stop_local_stack.ps1" "Gray"
