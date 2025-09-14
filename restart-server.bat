@echo off
echo Restarting KHS CRM Server...
echo ============================

REM Restart the PM2 managed process
npx pm2 restart khs-crm

echo.
echo ✅ KHS CRM Server restarted!
echo.
echo 📍 Open in browser: http://localhost:3000
echo 📊 Monitor server: npx pm2 monit
echo 📋 View logs: npx pm2 logs khs-crm
echo.
npx pm2 list
echo.
pause
