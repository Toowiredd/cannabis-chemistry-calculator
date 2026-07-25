<#
.SYNOPSIS
    Removes the CccPwaServer Windows Task Scheduler entry.

.DESCRIPTION
    Symmetric companion to install-pwa-server-task.ps1. Removes
    only the Task Scheduler entry. Does NOT touch the legacy
    HKCU\Run value (that cleanup is owned by the install script
    when upgrading from HKCU\Run to Task Scheduler).

    The script is idempotent - running it when the task is
    already removed is a no-op (prints a friendly message and
    exits 0).

.PARAMETER WhatIf
    Print what would be removed without actually unregistering
    the task.

.EXAMPLE
    powershell -ExecutionPolicy Bypass -File scripts\uninstall-pwa-server-task.ps1
    Removes the CccPwaServer scheduled task. Exits 0 even if the
    task was not present.

.NOTES
    No admin elevation required. The task is unregistered from
    the current user's Task Scheduler context.

    File encoding: this script is written in pure ASCII so that
    Windows PowerShell 5.1 (which reads .ps1 files as ANSI by
    default unless a UTF-8 BOM is present) can parse it without
    extra configuration.
#>
[CmdletBinding(SupportsShouldProcess = $true)]
param()

$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest

$TaskName = 'CccPwaServer'

$existing = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if (-not $existing) {
    Write-Host "[uninstall-pwa-server-task] no task '$TaskName' to remove (already absent)"
    exit 0
}

if ($WhatIfPreference) {
    Write-Host "[uninstall-pwa-server-task] WOULD unregister task '$TaskName'"
    Write-Host "  State:        $($existing.State)"
    Write-Host "  Author:       $($existing.Author)"
    Write-Host "  Description:  $($existing.Description)"
    if ($existing.Triggers.Count -gt 0) {
        Write-Host "  Trigger[0]:   $($existing.Triggers[0].CimClass.CimClassName)"
    }
    exit 0
}

Unregister-ScheduledTask -TaskName $TaskName -Confirm:$false
Write-Host "[uninstall-pwa-server-task] removed task '$TaskName'"

# Verify it's actually gone
$stillThere = Get-ScheduledTask -TaskName $TaskName -ErrorAction SilentlyContinue
if ($stillThere) {
    throw "[uninstall-pwa-server-task] verification failed - task '$TaskName' is still present after Unregister-ScheduledTask"
}
Write-Host "[uninstall-pwa-server-task] verified - task '$TaskName' is gone"
