param([Parameter(Mandatory=$true)][ValidateSet('codex','claude')][string]$Bot)
$ErrorActionPreference = 'Stop'
$botsRoot = $PSScriptRoot
$runtimePath = Join-Path $botsRoot 'private\runtime.json'
if (-not (Test-Path -LiteralPath $runtimePath)) { throw 'Run install.ps1 first.' }
$runtime = Get-Content -LiteralPath $runtimePath -Raw | ConvertFrom-Json
$env:HQ_ROOT = $runtime.hqRoot
$env:BRIDGE_PRIVATE_DIR = $runtime.bridgePrivateDir
$node = (Get-Command node -ErrorAction Stop).Source
$entry = if ($Bot -eq 'codex') { 'codex-bridge\bridge.mjs' } else { 'claude-relay\relay.mjs' }
$log = Join-Path $botsRoot ('private\' + $Bot + '.log')
$mutex = New-Object System.Threading.Mutex($false, ('Local\HQ-' + $Bot + '-Runner'))
if (-not $mutex.WaitOne(0)) { Write-Host 'This bot runner is already active.'; exit 0 }
try {
  Set-Location -LiteralPath $botsRoot
  while ($true) {
    if ((Test-Path -LiteralPath $log) -and (Get-Item -LiteralPath $log).Length -gt 10MB) { Move-Item -LiteralPath $log -Destination ($log + '.1') -Force }
    Add-Content -LiteralPath $log -Value ((Get-Date -Format o) + ' starting ' + $Bot)
    try { & $node (Join-Path $botsRoot $entry) *>> $log; $exitCode = $LASTEXITCODE }
    catch { $exitCode = 1; Add-Content -LiteralPath $log -Value $_.Exception.Message }
    Add-Content -LiteralPath $log -Value ((Get-Date -Format o) + ' exited ' + $exitCode + '; restarting in 10 seconds')
    Start-Sleep -Seconds 10
  }
} finally { $mutex.ReleaseMutex(); $mutex.Dispose() }
