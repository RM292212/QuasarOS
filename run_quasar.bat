@echo off
title QuasarOS Full-Stack Launcher
echo ========================================================
echo         Launching QuasarOS Full-Stack
echo ========================================================
start "QuasarOS Backend" "%~dp0\scripts\run_backend.bat"
start "QuasarOS Frontend" "%~dp0\scripts\run_frontend.bat"
echo Services launched in separate windows!
echo   Frontend: http://127.0.0.1:5173
echo   Backend:  http://127.0.0.1:8000
echo   Docs:     http://127.0.0.1:8000/docs
pause
