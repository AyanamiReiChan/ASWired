param(
    [string]$ServerDirectory = (Join-Path (Split-Path $PSScriptRoot -Parent) 'ASWired-Server'),
    [string]$ListenAddress = '127.0.0.1:12889',
    [string]$PublicUrl = 'http://localhost:5174',
    [string]$DataDirectory = ''
)
$ErrorActionPreference = 'Stop'
$aswiredServerRoot = (Resolve-Path -LiteralPath $ServerDirectory).Path
$aswiredServerBinary = Join-Path $aswiredServerRoot 'bin\aswired-server.exe'
if (-not (Test-Path -LiteralPath $aswiredServerBinary -PathType Leaf)) {
    throw '请先在 ASWired-Server 仓库构建 bin/aswired-server.exe。'
}
$env:ASWIRED_LISTEN = $ListenAddress
$env:ASWIRED_PUBLIC_URL = $PublicUrl.TrimEnd('/')
$env:ASWIRED_ALLOWED_ORIGINS = $env:ASWIRED_PUBLIC_URL
$aswiredPublicUri = [Uri]$env:ASWIRED_PUBLIC_URL
if ($aswiredPublicUri.Host -in @('localhost', '127.0.0.1')) {
    $env:ASWIRED_ALLOWED_ORIGINS = '{0}://localhost:{1},{0}://127.0.0.1:{1}' -f $aswiredPublicUri.Scheme, $aswiredPublicUri.Port
}
if ([string]::IsNullOrWhiteSpace($DataDirectory)) { $DataDirectory = Join-Path $aswiredServerRoot 'data' }
$env:ASWIRED_DATA_DIR = [IO.Path]::GetFullPath($DataDirectory)
Set-Location -LiteralPath $aswiredServerRoot
& $aswiredServerBinary serve
exit $LASTEXITCODE
