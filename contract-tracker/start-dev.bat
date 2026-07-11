@echo off
chcp 65001 >nul
title 合同跟踪平台 - 开发模式

echo ==================================================
echo  合同执行情况跟踪平台 — 开发模式启动
echo ==================================================
echo.

:: 启动后端（新窗口）
echo [1/2] 正在启动后端服务...
start "合同跟踪-后端" cmd /c "cd /d %~dp0server && echo 后端启动中... && npm run dev && pause"

:: 等一小会儿让后端先初始化
timeout /t 2 /nobreak >nul

:: 启动前端（新窗口）
echo [2/2] 正在启动前端开发服务器...
start "合同跟踪-前端" cmd /c "cd /d %~dp0client && echo 前端启动中... && npm run dev && pause"

echo.
echo ==================================================
echo  ✅ 正在启动中，请稍候...
echo.
echo  🌐 前端地址: http://localhost:5173
echo  🔧 后端地址: http://localhost:3001
echo.
echo  关闭窗口即可停止服务
echo ==================================================
echo.
pause
