@echo off
echo ===================================================
echo   F1 Telemetry Analyzer (Windows)
echo ===================================================
echo.

echo [1/4] Unblocking project script files...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Unblock-File -Path '%~dp0*.bat' -ErrorAction SilentlyContinue" 2>nul

if not exist "%~dp0frontend\node_modules\" (
    echo [2/4] Installing Frontend dependencies...
    cd /d "%~dp0frontend"
    call npm install
    cd /d "%~dp0"
    echo.
) else (
    echo [2/4] Frontend dependencies found.
)

echo [3/4] Starting Backend Server...
start "F1 Telemetry Backend" cmd /k "cd /d ""%~dp0"" && go run ./cmd/server"

echo [4/4] Starting Web Dashboard...
start "F1 Telemetry Frontend" cmd /k "cd /d ""%~dp0frontend"" && npm run dev"

echo.
echo ===================================================
echo   All systems go! Opening dashboard in browser...
echo ===================================================
timeout /t 3 /nobreak >nul
start http://localhost:5173

exit
