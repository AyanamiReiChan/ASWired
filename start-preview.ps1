param(
    [int]$Port = 5174,
    [string]$ApiTarget = 'http://127.0.0.1:12889'
)
$ErrorActionPreference = 'Stop'
$rayProject = Join-Path $PSScriptRoot 'frontend'
Set-Location -LiteralPath $rayProject
$rayNode = (Get-Command node -ErrorAction Stop).Source
$env:ASWIRED_API_TARGET = $ApiTarget
& $rayNode 'node_modules/vite/bin/vite.js' dev --host localhost --port $Port
exit $LASTEXITCODE
