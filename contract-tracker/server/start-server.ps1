# 合同跟踪平台 - 系统启动脚本
$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

$logFile = "$scriptDir\logs\server.log"
if (!(Test-Path "logs")) { New-Item -ItemType Directory -Path "logs" -Force | Out-Null }

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
"$timestamp === 系统启动 ===" | Out-File -Append -FilePath $logFile -Encoding utf8

# ---- Node.js（绝对路径，避免环境变量未加载）----
$nodePath = "C:\Users\Acer\.workbuddy\binaries\node\versions\22.22.2\node.exe"

if (-not (Test-Path $nodePath)) {
    # 回退尝试
    $fallback = @(
        "$env:ProgramFiles\nodejs\node.exe",
        "${env:ProgramFiles(x86)}\nodejs\node.exe"
    )
    foreach ($p in $fallback) {
        if (Test-Path $p) { $nodePath = $p; break }
    }
}

if (-not (Test-Path $nodePath)) {
    "$timestamp 错误: Node.js 路径不存在: $nodePath" | Out-File -Append -FilePath $logFile -Encoding utf8
    exit 1
}

"$timestamp Node.js: $nodePath" | Out-File -Append -FilePath $logFile -Encoding utf8

# ---- 杀掉旧进程（释放端口 3001）----
$existing = Get-NetTCPConnection -LocalPort 3001 -ErrorAction SilentlyContinue
if ($existing) {
    foreach ($conn in $existing) {
        Stop-Process -Id $conn.OwningProcess -Force -ErrorAction SilentlyContinue
        "$timestamp 已关闭旧进程 PID:$($conn.OwningProcess)" | Out-File -Append -FilePath $logFile -Encoding utf8
    }
    Start-Sleep -Seconds 3
}

# ---- 加载 .env ----
if (Test-Path ".env") {
    Get-Content .env | ForEach-Object {
        if ($_ -match '^\s*([^#=]+?)\s*=\s*(.+?)\s*$') {
            [Environment]::SetEnvironmentVariable($matches[1], $matches[2], "Process")
        }
    }
}

# ---- 启动服务 ----
$process = Start-Process -FilePath $nodePath -ArgumentList "dist\index.js" -NoNewWindow -PassThru -RedirectStandardOutput "$scriptDir\logs\stdout.log" -RedirectStandardError "$scriptDir\logs\stderr.log"

"$timestamp 服务已启动 PID:$($process.Id)" | Out-File -Append -FilePath $logFile -Encoding utf8
