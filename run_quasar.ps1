Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "               QUASAROS FULL STACK LAUNCHER               " -ForegroundColor Yellow
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "To launch both backend and frontend on your terminal:" -ForegroundColor Green
Write-Host "  powershell -ExecutionPolicy Bypass -File scripts/start_local_stack.ps1" -ForegroundColor White
Write-Host ""
Write-Host "Direct links once running:" -ForegroundColor Green
Write-Host "  • Frontend Web App:     http://127.0.0.1:5173" -ForegroundColor White
Write-Host "  • FastAPI Backend:      http://127.0.0.1:8000" -ForegroundColor White
Write-Host "  • Swagger/OpenAPI Docs: http://127.0.0.1:8000/docs" -ForegroundColor White
Write-Host "  • Liveness Health:      http://127.0.0.1:8000/health/live" -ForegroundColor White
Write-Host "  • Readiness Health:     http://127.0.0.1:8000/health/ready" -ForegroundColor White
Write-Host ""
Write-Host "To stop the running stack at any time:" -ForegroundColor Red
Write-Host "  powershell -ExecutionPolicy Bypass -File scripts/stop_local_stack.ps1" -ForegroundColor White
Write-Host "==========================================================" -ForegroundColor Cyan
