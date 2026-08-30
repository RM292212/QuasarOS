# QuasarOS Local Full-Stack Stopper
Get-Process python, node, npx, cmd -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -match "quasar" -or $_.CommandLine -match "uvicorn" -or $_.CommandLine -match "vite" } | Stop-Process -Force -ErrorAction SilentlyContinue
Write-Host "QuasarOS local stack stopped."
