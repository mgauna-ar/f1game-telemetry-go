@echo off
echo ===================================================
echo   F1 Telemetry Analyzer (Windows)
echo ===================================================
echo.

:: 0. Unblock batch files and set execution policy for current user
echo [0/4] Unblocking script files and applying execution policy...
powershell -Command "Unblock-File -Path '%~dp0*.bat' -ErrorAction SilentlyContinue"
powershell -Command "Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force" 2>nul

:: 1. Check and install frontend dependencies if missing
if not exist "frontend\node_modules\" (
    echo [1/4] Installing Frontend dependencies (npm install)...
    cd frontend
    call npm install
    cd ..
    echo.
) else (
    echo [1/4] Frontend dependencies found.
)

:: 2. Launch Backend (Go) in a new console window
echo [2/4] Starting Backend Server (Go)...
start "F1 Telemetry - Backend" cmd /k "powershell -Command \"Unblock-File -Path '%~dp0bin\*' -ErrorAction SilentlyContinue\"; go run ./cmd/server"

:: 3. Launch Frontend (React) in a new console window
echo [3/4] Starting Web Dashboard (React)...
start "F1 Telemetry - Frontend" cmd /k "cd frontend && npm run dev"

:: 4. Open dashboard in default browser
echo.
echo ===================================================
echo   All systems go! Opening dashboard in browser...
echo ===================================================
timeout /t 3 /nobreak >nul
start http://localhost:5173

exit
