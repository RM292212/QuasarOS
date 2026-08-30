@echo off
title QuasarOS Vite Frontend
cd /d "%~dp0\..\apps\web"
echo ========================================================
echo         Starting QuasarOS Vite Frontend
echo ========================================================
call npx vite --host 127.0.0.1 --port 5173
pause
