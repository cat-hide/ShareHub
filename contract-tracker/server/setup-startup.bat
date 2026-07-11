@echo off
chcp 65001 >nul
title 合同跟踪平台 - 开机自启设置

echo ============================================
echo   合同跟踪平台 - 开机自启动设置
echo ============================================
echo.

cd /d "%~dp0"

:: Step 1: 检查 Node.js
echo [1/5] 检查 Node.js...
where node >nul 2>&1
if %errorlevel% neq 0 (
    echo [错误] 未找到 Node.js，请先安装 Node.js
    echo       下载地址: https://nodejs.org/
    pause
    exit /b 1
)
echo        Node.js 已就绪

:: Step 2: 检查/安装 PM2
echo.
echo [2/5] 检查 PM2...
call npm list -g pm2 >nul 2>&1
if %errorlevel% neq 0 (
    echo        正在安装 PM2...
    call npm install -g pm2
    if %errorlevel% neq 0 (
        echo [错误] PM2 安装失败
        pause
        exit /b 1
    )
)
echo        PM2 已就绪

:: Step 3: 安装依赖 & 编译
echo.
echo [3/5] 安装依赖...
call npm install
if %errorlevel% neq 0 (
    echo [错误] 依赖安装失败
    pause
    exit /b 1
)

echo.
echo [4/5] 编译 TypeScript...
call npm run build
if %errorlevel% neq 0 (
    echo [错误] 编译失败，请检查代码错误
    pause
    exit /b 1
)

:: Step 4: 启动 PM2 并保存
echo.
echo [5/5] 配置 PM2 开机自启...
:: 先停掉旧实例（如果存在）
call pm2 delete contract-tracker 2>nul
:: 启动
call pm2 start ecosystem.config.js
:: 保存进程列表（重启后恢复）
call pm2 save

:: 配置 Windows 开机自启
call pm2 startup | findstr /C:"copy and paste" > startup_cmd.txt
if exist startup_cmd.txt (
    echo 请以管理员身份运行以下命令（已保存到 startup_cmd.txt）：
    type startup_cmd.txt
) else (
    echo        PM2 已配置为开机自启
)

echo.
echo ============================================
echo   设置完成！
echo.
echo   常用命令：
echo     pm2 status         查看运行状态
echo     pm2 logs            查看日志
echo     pm2 restart all     重启所有服务
echo     pm2 stop all        停止所有服务
echo ============================================
echo.

pause
