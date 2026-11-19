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
# Global: 로그아웃·로그인으로 세션이 바뀌어도 실행기가 둘 생기지 않게 한다(2026-11-18 Tony 실행기 중복, 재시작 3,700회).
$mutex = New-Object System.Threading.Mutex($false, ('Global\HQ-' + $Bot + '-Runner'))
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
