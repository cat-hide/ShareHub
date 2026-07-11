@echo off
cd /d "D:\ShareHub\contract-tracker\server"

:: 日志目录
if not exist "logs" mkdir logs

echo [%date% %time%] === 启动合同跟踪平台 === >> logs\server.log

:: 尝试多种方式定位 node.exe
set NODE_EXE=
:: 1. 检查系统 PATH
for /f "delims=" %%i in ('where node 2^>nul') do set NODE_EXE=%%i
:: 2. 常见安装路径
if not defined NODE_EXE if exist "C:\Program Files\nodejs\node.exe" set NODE_EXE=C:\Program Files\nodejs\node.exe
if not defined NODE_EXE if exist "%ProgramFiles%\nodejs\node.exe" set NODE_EXE=%ProgramFiles%\nodejs\node.exe
:: 3. nvm-windows
if not defined NODE_EXE for /f "delims=" %%i in ('dir /b /s "%APPDATA%\nvm\*\node.exe" 2^>nul') do set NODE_EXE=%%i
:: 4. fnm
if not defined NODE_EXE if exist "%LOCALAPPDATA%\fnm\aliases\default\node.exe" set NODE_EXE=%LOCALAPPDATA%\fnm\aliases\default\node.exe

if not defined NODE_EXE (
    echo [%date% %time%] 错误: 找不到 Node.js >> logs\server.log
    exit /b 1
)

echo [%date% %time%] Node.js: %NODE_EXE% >> logs\server.log

:: 等待网络就绪
timeout /t 5 /nobreak >nul

:: 启动
"%NODE_EXE%" dist\index.js >> logs\server.log 2>&1
