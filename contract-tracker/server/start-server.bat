@echo off
:: 合同跟踪平台 - 开机自启脚本
chcp 65001 >nul
cd /d "D:\ShareHub\contract-tracker\server"

:: 确保日志目录存在
if not exist "logs" mkdir logs

:: 记录启动时间
echo [%date% %time%] 开始启动... >> logs\server.log

:: 尝试找到 node.exe
set NODE_PATH=
for %%d in (
    "C:\Program Files\nodejs"
    "C:\Program Files (x86)\nodejs"
    "%APPDATA%\nvm\*\node.exe"
) do (
    if exist "%%~d\node.exe" set NODE_PATH=%%~d\node.exe
)
if not defined NODE_PATH (
    where node >nul 2>&1 && set NODE_PATH=node || set NODE_PATH=node
)

:: 杀掉旧的 node 进程（避免端口冲突）
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001.*LISTENING" 2^>nul') do (
    taskkill /F /PID %%a >nul 2>&1
    echo [%date% %time%] 已关闭旧进程 PID:%%a >> logs\server.log
)

:: 等待端口释放
timeout /t 3 /nobreak >nul

:: 启动服务
%NODE_PATH% dist\index.js >> logs\server.log 2>&1
