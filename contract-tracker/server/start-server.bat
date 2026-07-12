@echo off
cd /d "D:\ShareHub\contract-tracker\server"
if not exist "logs" mkdir logs
echo [%date% %time%] start >> logs\server.log
C:\Users\Acer\.workbuddy\binaries\node\versions\22.22.2\node.exe dist\index.js >> logs\server.log 2>&1
