@echo off
chcp 65001 >nul
title 合同执行情况跟踪平台

echo ==================================================
echo     合同执行情况跟踪平台 — 启动中...
echo ==================================================
echo.

:: 重新构建前端
echo [1/2] 正在构建前端...
cd /d "%~dp0client"
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo ❌ 前端构建失败，请检查依赖是否安装
    pause
    exit /b 1
)
echo ✅ 前端构建完成

echo.
echo [2/2] 启动后端服务...
echo.
echo 🌐 访问地址: http://localhost:3001
echo.
echo 按 Ctrl+C 停止服务
echo ==================================================
echo.

cd /d "%~dp0server"
call npm run dev
pause
