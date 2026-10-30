# Installs F1 Telemetry with its installer, silently, in a temporary folder and uninstalls it twice,
# checking what each leaves: the app, its Start menu shortcut and its uninstall entry come and go,
# the database stays, and Start with Windows goes only when it starts this copy. For a throwaway
# Windows such as a CI runner: it changes this user's Start with Windows entry.
param([Parameter(Mandatory)][string]$Installer)

$ErrorActionPreference = 'Stop'
$temp = if ($env:RUNNER_TEMP) { $env:RUNNER_TEMP } else { $env:TEMP }
$dir = Join-Path $temp 'F1 Telemetry test'
$exe = Join-Path $dir 'f1telemetry.exe'
$db = Join-Path $dir 'f1telemetry.db'
$uninstallKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\F1Telemetry'
$runKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
$runValue = 'F1 Telemetry'
$shortcut = Join-Path ([Environment]::GetFolderPath('Programs')) 'F1 Telemetry.lnk'
$setup = (Resolve-Path $Installer).Path

# NSIS reads the folder switch (/D= or _?=) last and unquoted, spaces and all
function Invoke-Silently([string]$Program, [string]$FolderSwitch) {
  $p = Start-Process -FilePath $Program -ArgumentList "/S $FolderSwitch$dir" -Wait -PassThru
  if ($p.ExitCode -ne 0) { throw "$Program exited with $($p.ExitCode)" }
}

function Install {
  Invoke-Silently $setup '/D='
  if (-not (Test-Path $exe)) { throw "the app wasn't installed in $dir" }
  if (-not (Test-Path $shortcut)) { throw 'the Start menu shortcut is missing' }
  if ((Get-ItemProperty $uninstallKey).InstallLocation -ne $dir) { throw 'the uninstall entry is missing' }
}

# _?= runs the uninstaller in place, so it's waited for (and can't delete itself)
function Uninstall {
  Invoke-Silently (Join-Path $dir 'uninstall.exe') '_?='
  if (Test-Path $exe) { throw "the app wasn't removed" }
  if (Test-Path $shortcut) { throw 'the Start menu shortcut was left' }
  if (Test-Path $uninstallKey) { throw 'the uninstall entry was left' }
}

# What the app's Start with Windows writes for a copy in $Folder (internal/desktop/autostart_windows.go)
function Set-StartWithWindows([string]$Folder) {
  $command = "`"$Folder\f1telemetry.exe`" -autostart `"-db=$Folder\f1telemetry.db`""
  Set-ItemProperty $runKey -Name $runValue -Value $command
}

function Get-StartWithWindows {
  (Get-ItemProperty $runKey -Name $runValue -ErrorAction SilentlyContinue).$runValue
}

# A copy in another folder keeps its Start with Windows, and the database stays
Install
Set-Content $db 'sessions'
Set-StartWithWindows 'C:\Games\F1 Telemetry'
Uninstall
if (-not (Test-Path $db)) { throw 'the database was removed' }
if (-not (Get-StartWithWindows)) { throw "another copy's Start with Windows was removed" }

# This copy's Start with Windows goes with it
Install
Set-StartWithWindows $dir
Uninstall
if (Get-StartWithWindows) { throw "this copy's Start with Windows was left" }
if (-not (Test-Path $db)) { throw 'the database was removed' }

Write-Output 'The installer installs and uninstalls F1 Telemetry, and leaves its database.'
