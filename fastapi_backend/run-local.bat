@echo off
cd /d "%~dp0"
echo Installing FastAPI backend requirements...
py -m pip install -r requirements.txt
echo.
echo Starting OxyGuard FastAPI backend...
echo Health check: http://localhost:8000/api/v1/health
echo.
py -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
pause
