@echo off
echo ===================================================
echo   F1 Telemetry Simulator (Windows)
echo ===================================================
echo.

powershell -NoProfile -ExecutionPolicy Bypass -Command "Unblock-File -Path '%~dp0*.bat' -ErrorAction SilentlyContinue; Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned -Force"

echo Streaming synthetic telemetry packets for testing...
echo Press Ctrl+C to stop the simulator at any time.
echo.
go run ./cmd/simulator -session race
pause
