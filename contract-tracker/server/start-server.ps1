# 合同跟踪平台 - 系统启动脚本
$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

$logFile = "$scriptDir\logs\server.log"
if (!(Test-Path "logs")) { New-Item -ItemType Directory -Path "logs" -Force | Out-Null }

$timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
"$timestamp === 系统启动 ===" | Out-File -Append -FilePath $logFile -Encoding utf8

# ---- 查找 Node.js ----
$nodePath = $null
$searchPaths = @(
    (Get-Command node -ErrorAction SilentlyContinue).Source,
    "$env:ProgramFiles\nodejs\node.exe",
    "${env:ProgramFiles(x86)}\nodejs\node.exe",
    "$env:LOCALAPPDATA\fnm\aliases\default\node.exe"
)

# 也搜索 nvm 目录
try {
    $nvmDirs = Get-ChildItem "$env:APPDATA\nvm" -Directory -ErrorAction SilentlyContinue
    foreach ($dir in $nvmDirs) {
        $nvmNode = Join-Path $dir.FullName "node.exe"
        if (Test-Path $nvmNode) { $searchPaths += $nvmNode }
    }
} catch {}

foreach ($p in $searchPaths) {
    if ($p -and (Test-Path $p)) {
        $nodePath = $p
        break
    }
}

if (-not $nodePath) {
    "$timestamp 错误: 找不到 Node.js 安装" | Out-File -Append -FilePath $logFile -Encoding utf8
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
