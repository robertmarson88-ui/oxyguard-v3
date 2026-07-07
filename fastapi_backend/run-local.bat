@echo off
cd /d "%~dp0"
set "PYTHON=C:\Users\twcl.ssa\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe"
echo Installing FastAPI backend requirements...
"%PYTHON%" -m pip install -r requirements.txt
echo.
echo Starting OxyGuard FastAPI backend...
echo Health check: http://localhost:8000/api/v1/health
echo.
"%PYTHON%" -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
pause
