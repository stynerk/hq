param(
  [string]$HqRoot = (Split-Path -Parent $PSScriptRoot),
  [string]$BridgePrivateDir = 'C:\Users\styne\orca\discord-codex\private',
  [switch]$StartNow
)
$ErrorActionPreference = 'Stop'
$HqRoot = (Resolve-Path -LiteralPath $HqRoot).Path
$botsRoot = Join-Path $HqRoot 'bots'
foreach ($command in @('git', 'node', 'npm', 'codex', 'claude')) {
  if (-not (Get-Command $command -ErrorAction SilentlyContinue)) { throw "$command is missing from PATH. Install/sign in first, then rerun." }
}
$nodeVersion = (& node -p 'process.versions.node').Trim()
if ([int]($nodeVersion.Split('.')[0]) -lt 22) { throw 'Node.js 22 or newer is required.' }
if (-not (Test-Path -LiteralPath (Join-Path $botsRoot 'claude-relay\relay.mjs'))) { throw 'Claude relay is missing from this checkout.' }
if (-not (Test-Path -LiteralPath (Join-Path $botsRoot 'codex-bridge\bridge.mjs'))) { throw 'Codex bridge is missing from this checkout.' }
if (Get-NetTCPConnection -LocalPort 38471 -State Listen -ErrorAction SilentlyContinue) { throw 'Port 38471 is busy. Close the old Codex bridge before installing. No processes were stopped.' }
Push-Location $botsRoot
try {
  & npm ci
  if ($LASTEXITCODE -ne 0) { throw 'npm ci failed; tasks were not changed.' }
  & npm test
  if ($LASTEXITCODE -ne 0) { throw 'Tests failed; tasks were not changed.' }
  $env:HQ_ROOT = $HqRoot
  & node tools/preflight.mjs
  if ($LASTEXITCODE -ne 0) { throw 'Project preflight failed; tasks were not changed. Back up and fix the listed local settings first.' }
} finally { Pop-Location }

$privateRoot = Join-Path $botsRoot 'private'
New-Item -ItemType Directory -Force -Path $privateRoot | Out-Null
$runtimeConfig = @{ hqRoot = $HqRoot; bridgePrivateDir = $BridgePrivateDir }
$runtimeConfig | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $privateRoot 'runtime.json') -Encoding UTF8
$identity = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$principal = New-ScheduledTaskPrincipal -UserId $identity -LogonType Interactive -RunLevel Limited
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $identity
$settings = New-ScheduledTaskSettingsSet -RestartCount 3 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$powershell = Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe'
foreach ($entry in @(@{Name='HQ Codex Bridge'; Bot='codex'}, @{Name='HQ Claude Relay'; Bot='claude'})) {
  $arguments = '-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + (Join-Path $botsRoot 'run.ps1') + '" -Bot ' + $entry.Bot
  $action = New-ScheduledTaskAction -Execute $powershell -Argument $arguments -WorkingDirectory $botsRoot
  Register-ScheduledTask -TaskName $entry.Name -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Force | Out-Null
}
Write-Host 'Installed current-user logon tasks. Old processes were not stopped.'
Write-Host 'Close old Codex bridge, PM_Sora/start-sora.cmd, and HJ Company plugin sessions before starting the new tasks.'
Write-Host 'Run Claude relay once in a visible console to initialize/import its token before hidden startup.'
if ($StartNow) {
  Write-Warning 'StartNow was requested. Ensure old token-sharing processes are closed.'
  Start-ScheduledTask -TaskName 'HQ Codex Bridge'
  Start-ScheduledTask -TaskName 'HQ Claude Relay'
} else { Write-Host 'After token setup: Start-ScheduledTask -TaskName "HQ Codex Bridge"; Start-ScheduledTask -TaskName "HQ Claude Relay"' }
