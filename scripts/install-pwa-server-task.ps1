<#
.SYNOPSIS
    Registers the CccPwaServer Windows Task Scheduler entry.

.DESCRIPTION
    Promotes the PWA static-server autostart from the legacy
    HKCU\Software\Microsoft\Windows\CurrentVersion\Run\CccPwaServer
    registry key to a Windows Task Scheduler entry that runs at
    user logon (including at the lock screen, which HKCU\Run does
    not cover).

    The task launches node.exe with the serve-pwa.cjs script
    directly (no cmd /c wrapper) so the parent process chain in
    Task Manager shows node.exe -> svchost.exe instead of
    cmd.exe -> node.exe.

    The script is idempotent - re-running updates the task.
    -Force is passed to Register-ScheduledTask, so a previous
    install is replaced, not duplicated.

.PARAMETER WhatIf
    Print what would be registered without actually creating the
    scheduled task. The legacy HKCU\Run cleanup is also skipped
    in WhatIf mode.

.PARAMETER Uninstall
    Remove the scheduled task (calls the same logic as
    uninstall-pwa-server-task.ps1) and exit. Does NOT remove the
    legacy HKCU\Run key in this mode - pass -Uninstall to the
    dedicated uninstall script for that.

.PARAMETER KeepLegacyRunKey
    Skip the legacy HKCU\Run removal even if the value exists.
    Default: remove the legacy value after the new task is
    successfully registered.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\install-pwa-server-task.ps1
    Registers the task and removes the legacy HKCU\Run value.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\install-pwa-server-task.ps1 -WhatIf
    Prints the planned task definition, does not register it.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\install-pwa-server-task.ps1 -Uninstall
    Removes the CccPwaServer scheduled task.

.NOTES
    No admin elevation required. The task is registered in the
    current user's Task Scheduler context. Runs on Windows 10/11
    with PowerShell 5.1+ (uses the Schedule.Service COM API).

    File encoding: this script is written in pure ASCII so that
    Windows PowerShell 5.1 (which reads .ps1 files as ANSI by
    default unless a UTF-8 BOM is present) can parse it without
    extra configuration. Replace any em-dashes with hyphens and
    right-arrows with -> before adding new content.
#>
[CmdletBinding(SupportsShouldProcess = $true)]
param(
    [switch]$Uninstall,
    [switch]$KeepLegacyRunKey
)

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

# --- Paths ------------------------------------------------------------------
$RepoRoot        = 'C:\Users\LEWIS\ccc\cannabis_chemistry_calculator'
$ScriptPath      = Join-Path $RepoRoot 'scripts\serve-pwa.cjs'
$TaskName        = 'CccPwaServer'
$TaskDescription = 'Cannabis Chemistry Calculator PWA static server (node serve-pwa.cjs on 127.0.0.1:8765)'
$LegacyRunKey    = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
$LegacyRunValue  = 'CccPwaServer'
$NodeExe         = (Get-Command node.exe -ErrorAction Stop).Source
$CurrentUser     = [System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value

function Remove-CccPwaServerTask {
    [CmdletBinding()]
    param()
    $existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
    if ($existing) {
        Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
        Write-Host "[install-pwa-server-task] removed task '$TaskName'"
    } else {
        Write-Host "[install-pwa-server-task] no task '$TaskName' to remove"
    }
}

function Show-TaskDefinition {
    [CmdletBinding()]
    param(
        [string]$Node,
        [string]$ScriptArg,
        [string]$WorkingDir,
        [string]$User
    )
    Write-Host '[install-pwa-server-task] WOULD register the following task:'
    Write-Host "  Name:           $TaskName"
    Write-Host "  Description:    $TaskDescription"
    Write-Host "  Trigger:        AtLogOn (user $User)"
    Write-Host "  Principal:      $User (Interactive, Limited)"
    Write-Host "  Action Execute: $Node"
    Write-Host "  Action Args:    $ScriptArg"
    Write-Host "  WorkDir:        $WorkingDir"
    Write-Host '  Settings:       AllowStartIfOnBatteries=True, DontStopIfGoingOnBatteries=True, ExecutionTimeLimit=00:00:00 (unlimited), MultipleInstances=IgnoreNew'
}

# --- Uninstall short-circuit ------------------------------------------------
if ($Uninstall) {
    Remove-CccPwaServerTask
    exit 0
}

# --- Pre-flight sanity checks ----------------------------------------------
if (-not (Test-Path -LiteralPath $ScriptPath)) {
    throw "[install-pwa-server-task] serve-pwa.cjs not found at $ScriptPath"
}
if (-not ($NodeExe -and (Test-Path -LiteralPath $NodeExe))) {
    throw '[install-pwa-server-task] node.exe not found in PATH; install Node.js first'
}
if (-not $CurrentUser) {
    throw '[install-pwa-server-task] could not resolve current user SID'
}

# --- WhatIf dry run ---------------------------------------------------------
# SupportsShouldProcess is enabled at the [CmdletBinding()] level, so
# the framework binds $WhatIfPreference and skips the script body when
# the user passes -WhatIf. We also support explicit -WhatIf via
# $PSBoundParameters for clarity in the test suite.
if ($WhatIfPreference -or $PSBoundParameters.ContainsKey('WhatIf')) {
    Show-TaskDefinition -Node $NodeExe -ScriptArg $ScriptPath -WorkingDir $RepoRoot -User $CurrentUser
    Write-Host '[install-pwa-server-task] dry run - no changes made'
    exit 0
}

# --- Register the task ------------------------------------------------------
Write-Host "[install-pwa-server-task] node.exe: $NodeExe"
Write-Host "[install-pwa-server-task] script:   $ScriptPath"
Write-Host "[install-pwa-server-task] user:     $CurrentUser"

$action = New-ScheduledTaskAction `
    -Execute $NodeExe `
    -Argument "`"$ScriptPath`"" `
    -WorkingDirectory $RepoRoot

# AtLogOn with no -User binds to the principal's user. We want the
# current user explicitly so the task is owned by the right SID.
$trigger = New-ScheduledTaskTrigger -AtLogOn -User $CurrentUser

$principal = New-ScheduledTaskPrincipal `
    -UserId $CurrentUser `
    -LogonType Interactive `
    -RunLevel Limited

# ExecutionTimeLimit = (New-TimeSpan) = 00:00:00 which the
# Windows API maps to "Unlimited" (PT0S).
$settings = New-ScheduledTaskSettingsSet `
    -AllowStartIfOnBatteries `
    -DontStopIfGoingOnBatteries `
    -ExecutionTimeLimit (New-TimeSpan) `
    -MultipleInstances IgnoreNew `
    -StartWhenAvailable

# -Force replaces any existing task with the same name. This is
# what makes the script idempotent - a second run does not
# produce two tasks, it just updates the existing one.
Register-ScheduledTask `
    -TaskName $TaskName `
    -Action $action `
    -Trigger $trigger `
    -Principal $principal `
    -Settings $settings `
    -Description $TaskDescription `
    -Force `
    -ErrorAction Stop | Out-Null

Write-Host "[install-pwa-server-task] registered task '$TaskName'"

# --- Verify registration ----------------------------------------------------
$registered = Get-ScheduledTask -TaskName $TaskName -ErrorAction Stop
Write-Host "[install-pwa-server-task] verified - trigger type: $($registered.Triggers[0].CimClass.CimClassName) (expected MSFT_TaskLogonTrigger)"

# --- Legacy HKCU\Run cleanup -----------------------------------------------
$legacy = Get-ItemProperty -Path $LegacyRunKey -Name $LegacyRunValue -ErrorAction SilentlyContinue
if ($legacy) {
    if ($KeepLegacyRunKey) {
        Write-Warning "[install-pwa-server-task] legacy HKCU\Run\$LegacyRunValue still present (-KeepLegacyRunKey set); both autostart mechanisms will fire"
    } else {
        Write-Host "[install-pwa-server-task] legacy HKCU\Run\$LegacyRunValue found:"
        Write-Host "                        $($legacy.$LegacyRunValue)"
        Write-Host '[install-pwa-server-task] WARNING: the legacy HKCU\Run autostart will be removed; the Task Scheduler entry replaces it'
        Remove-ItemProperty -Path $LegacyRunKey -Name $LegacyRunValue -ErrorAction Stop
        Write-Host "[install-pwa-server-task] removed legacy HKCU\Run\$LegacyRunValue"
    }
} else {
    Write-Host "[install-pwa-server-task] no legacy HKCU\Run\$LegacyRunValue to clean up"
}

Write-Host "[install-pwa-server-task] done. Run 'pnpm pwa:task-status' to inspect."
