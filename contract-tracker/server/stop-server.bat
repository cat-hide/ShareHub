@echo off
chcp 65001 >nul
title 合同跟踪平台 - 停止

cd /d "%~dp0"

echo 正在停止合同跟踪平台...
call pm2 stop contract-tracker
call pm2 save

echo.
echo 服务已停止。
pause
