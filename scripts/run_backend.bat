@echo off
title QuasarOS FastAPI Backend
cd /d "%~dp0\.."
echo ========================================================
echo         Starting QuasarOS FastAPI Backend
echo ========================================================
set PYTHONPATH=%cd%\packages\services\src;%cd%\packages\contracts\src;%PYTHONPATH%
python -m uvicorn quasar_services.app:app --host 127.0.0.1 --port 8000 --reload
pause
