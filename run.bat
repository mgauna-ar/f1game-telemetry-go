@echo off
echo ===================================================
echo   F1 Telemetry Analyzer (Windows)
echo ===================================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "Unblock-File -Path '%~dp0*.bat' -ErrorAction SilentlyContinue" 2>nul

:: Check prerequisites
where go >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Go compiler is not installed or not in PATH.
    echo Please install Go 1.21+ from https://go.dev/dl/
    echo.
    pause
    exit /b 1
)

where npm >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js / npm is not installed or not in PATH.
    echo Please install Node.js 18+ from https://nodejs.org/
    echo.
    pause
    exit /b 1
)

echo [1/3] Preparing embedded frontend web assets...
cd /d "%~dp0frontend"
if not exist "node_modules" (
    echo Installing frontend dependencies...
    call npm install --prefer-offline --no-audit --no-fund
    if errorlevel 1 (
        echo [ERROR] Failed to install frontend dependencies.
        cd /d "%~dp0"
        pause
        exit /b 1
    )
)

echo Building production web assets...
call npm run build
if errorlevel 1 (
    echo [ERROR] Failed to build frontend assets.
    cd /d "%~dp0"
    pause
    exit /b 1
)
cd /d "%~dp0"
echo.

echo [2/3] Compiling standalone executable with embedded frontend...
if not exist "%~dp0bin" mkdir "%~dp0bin"

set "VERSION="
set "COMMIT="
set "BUILD_DATE="
for /f "usebackq tokens=*" %%i in (`git describe --tags --exact-match 2^>nul`) do set "VERSION=%%i"
for /f "usebackq tokens=*" %%i in (`git rev-parse --short HEAD 2^>nul`) do set "COMMIT=%%i"
if "%VERSION%"=="" set "VERSION=dev"
if "%COMMIT%"=="" set "COMMIT=none"
for /f "usebackq tokens=*" %%i in (`powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-Date -Format yyyy-MM-dd" 2^>nul`) do set "BUILD_DATE=%%i"
if "%BUILD_DATE%"=="" set "BUILD_DATE=unknown"

go build -ldflags="-s -w -X main.version=%VERSION% -X main.commit=%COMMIT% -X main.date=%BUILD_DATE%" -o "%~dp0bin\f1telemetry.exe" ./cmd/server
if errorlevel 1 (
    echo [ERROR] Failed to build standalone server executable.
    pause
    exit /b 1
)
echo.

echo [3/3] Starting F1 Telemetry Analyzer...
echo.
set ARGS=%*
"%~dp0bin\f1telemetry.exe" %ARGS%
if errorlevel 1 (
    echo.
    echo [ERROR] Application exited with error code %errorlevel%.
    pause
)
