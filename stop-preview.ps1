$ErrorActionPreference = 'Stop'
$rayPidFile = Join-Path $PSScriptRoot 'frontend\outputs\dev.pid'
if (-not (Test-Path -LiteralPath $rayPidFile)) { Write-Host '没有本项目的进程记录。'; return }
$rayServerPid = [int](Get-Content -LiteralPath $rayPidFile)
$rayServer = Get-CimInstance Win32_Process -Filter "ProcessId=$rayServerPid"
if ($rayServer -and $rayServer.Name -eq 'node.exe' -and $rayServer.CommandLine -match 'vite[/\\]bin[/\\]vite\.js.*--port\s+5174') {
    Stop-Process -Id $rayServerPid -Force
    Write-Host 'ASWired 本地预览已停止。'
} else { Write-Host '进程不存在或身份不符，没有停止其他程序。' }
