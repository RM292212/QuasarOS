@echo off
title QuasarOS Full-Stack Orchestrator
cd /d "%~dp0"
echo ========================================================
echo         Launching QuasarOS Full-Stack Orchestrator
echo ========================================================
powershell -ExecutionPolicy Bypass -File "%~dp0\scripts\start_local_stack.ps1"
pause
