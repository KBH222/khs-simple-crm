@echo off
echo KHS CRM Server Monitor
echo ======================

:menu
echo.
echo Choose an option:
echo 1. View server status
echo 2. View real-time logs
echo 3. View real-time monitoring (CPU, Memory)
echo 4. View backup status
echo 5. Create manual backup
echo 6. Exit
echo.
set /p choice=Enter your choice (1-6): 

if "%choice%"=="1" goto status
if "%choice%"=="2" goto logs
if "%choice%"=="3" goto monitor
if "%choice%"=="4" goto backup
if "%choice%"=="5" goto create_backup
if "%choice%"=="6" goto exit
echo Invalid choice. Please try again.
goto menu

:status
echo.
echo Server Status:
npx pm2 list
echo.
pause
goto menu

:logs
echo.
echo Real-time logs (Press Ctrl+C to stop):
npx pm2 logs khs-crm
goto menu

:monitor
echo.
echo Real-time monitoring (Press q to quit):
npx pm2 monit
goto menu

:backup
echo.
echo Backup Status:
dir backups
echo.
pause
goto menu

:create_backup
echo.
echo Creating manual backup...
curl -X POST http://localhost:3000/api/backup/create
echo.
echo Backup created!
pause
goto menu

:exit
echo Goodbye!
