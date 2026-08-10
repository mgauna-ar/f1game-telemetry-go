@echo off
echo ===================================================
echo   F1 Telemetry Simulator (Windows)
echo ===================================================
echo.

:: Unblock script files and set execution policy
powershell -Command "Unblock-File -Path '%~dp0*.bat' -ErrorAction SilentlyContinue"
powershell -Command "Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force" 2>nul

echo Streaming synthetic telemetry packets for testing...
echo Press Ctrl+C to stop the simulator at any time.
echo.
go run ./cmd/simulator -session race
pause
