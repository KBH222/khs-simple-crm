@echo off
echo Stopping KHS CRM Server...
echo ===========================

REM Stop PM2 managed processes
npx pm2 stop khs-crm
npx pm2 delete khs-crm

echo.
echo ✅ KHS CRM Server stopped!
echo.
echo To start again, run: start-server.bat
echo.
pause
