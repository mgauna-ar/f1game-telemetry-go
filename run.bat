@echo off
echo ===================================================
echo   F1 Telemetry Analyzer (Windows)
echo ===================================================
echo.

echo [1/4] Unblocking project script files...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Unblock-File -Path '%~dp0*.bat' -ErrorAction SilentlyContinue" 2>nul

echo [2/4] Verifying and updating frontend dependencies...
cd /d "%~dp0frontend"
call npm install --prefer-offline --no-audit --no-fund
cd /d "%~dp0"
echo.

echo [3/4] Building and Starting Backend Server...
if not exist "%~dp0bin" mkdir "%~dp0bin"
go build -o "%~dp0bin\server.exe" ./cmd/server
if errorlevel 1 (
    echo [ERROR] Failed to build backend server.
    pause
    exit /b 1
)
start "F1 Telemetry Backend" /d "%~dp0" cmd /k "bin\server.exe -no-browser"

echo [4/4] Starting Web Dashboard...
start "F1 Telemetry Frontend" /d "%~dp0frontend" cmd /k "npm run dev"

for /f "usebackq tokens=*" %%i in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "(Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -notlike '127.*' -and $_.IPAddress -notlike '169.254.*' } | Select-Object -ExpandProperty IPAddress -First 1)"`) do set "LOCAL_IP=%%i"

if "%LOCAL_IP%"=="" set "LOCAL_IP=<YOUR-IP>"

:: Wait 1.5 seconds for Vite dev server to bind, then open the browser to port 5173
timeout /t 2 /nobreak >nul 2>&1
start http://localhost:5173

echo.
echo ===================================================
echo   All systems go! Servers are running.
echo.
echo   Local access:    http://localhost:5173
echo   Network access:  http://%LOCAL_IP%:5173
echo ===================================================

exit
