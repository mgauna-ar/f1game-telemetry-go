@echo off
echo ===================================================
echo   F1 Telemetry Simulator (Windows)
echo ===================================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "Unblock-File -Path '%~dp0*.bat' -ErrorAction SilentlyContinue" 2>nul

if not exist "%~dp0bin" mkdir "%~dp0bin"
echo Building simulator...
go build -o "%~dp0bin\simulator.exe" ./cmd/simulator
if errorlevel 1 (
    echo [ERROR] Failed to build simulator.
    pause
    exit /b 1
)

echo.
echo Streaming synthetic telemetry packets for testing...
echo Press Ctrl+C to stop the simulator at any time.
echo.
set ARGS=%*
if "%ARGS%"=="" set ARGS=-session race
"%~dp0bin\simulator.exe" %ARGS%
pause
