@echo off
echo Starting KHS CRM Server...
echo =============================

REM Kill any existing node processes
taskkill /f /im "node.exe" >nul 2>&1

REM Start PM2 and the CRM server
npx pm2 start ecosystem.config.js --env production

echo.
echo ✅ KHS CRM Server is now running!
echo.
echo 📍 Open in browser: http://localhost:3000
echo 📊 Monitor server: npx pm2 monit
echo 📋 View logs: npx pm2 logs khs-crm
echo 🛑 Stop server: stop-server.bat
echo.
echo Press any key to view server status...
pause >nul

npx pm2 list
echo.
echo Press any key to exit...
pause >nul
