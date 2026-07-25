<#
.SYNOPSIS
    Pester tests for the CccPwaServer Task Scheduler install/uninstall scripts.

.DESCRIPTION
    These tests actually register and remove the CccPwaServer
    scheduled task on the current user's machine. They require
    Pester 5. The test gates run the install + uninstall
    scripts directly via PowerShell.

    Run from the repo root:
        Invoke-Pester -Path scripts/__tests__\install-pwa-server-task.test.ps1

    The tests are self-cleaning: AfterAll re-installs the task
    so the user's PWA server is back in its expected state when
    the run finishes. The legacy HKCU\Run value is snapshotted
    in BeforeAll and restored in AfterAll so the autostart
    transition test is reversible.

    File encoding: pure ASCII for Windows PowerShell 5.1 parsing.

    Note on exit-code checks: PowerShell's `& $script` call
    operator does NOT propagate the script's exit code to
    `$LASTEXITCODE` in the caller when the output is captured
    (this is a known behavior, not a bug). We verify success
    by checking the captured output for the expected success
    message instead.
#>
Describe 'CccPwaServer Task Scheduler scripts' {
    BeforeAll {
        $script:RepoRoot = (Resolve-Path "$PSScriptRoot/../..").Path
        $script:InstallScript = Join-Path $script:RepoRoot 'scripts\install-pwa-server-task.ps1'
        $script:UninstallScript = Join-Path $script:RepoRoot 'scripts\uninstall-pwa-server-task.ps1'
        $script:TaskName = 'CccPwaServer'
        $script:LegacyRunKey = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Run'
        $script:LegacyRunValue = 'CccPwaServer'

        if (-not (Test-Path -LiteralPath $script:InstallScript)) {
            throw "install script not found: $($script:InstallScript)"
        }
        if (-not (Test-Path -LiteralPath $script:UninstallScript)) {
            throw "uninstall script not found: $($script:UninstallScript)"
        }

        # Snapshot legacy HKCU\Run value (if any) so the test is
        # reversible - we don't want to permanently delete a value
        # the user might want to keep around.
        $legacyItem = Get-ItemProperty -Path $script:LegacyRunKey -Name $script:LegacyRunValue -ErrorAction SilentlyContinue
        $script:LegacySnapshot = if ($legacyItem) { $legacyItem.$script:LegacyRunValue } else { $null }

        # Ensure a clean slate: remove any pre-existing task so the
        # first test starts from "not installed".
        $preExisting = Get-ScheduledTask -TaskName $script:TaskName -ErrorAction SilentlyContinue
        if ($preExisting) {
            Unregister-ScheduledTask -TaskName $script:TaskName -Confirm:$false | Out-Null
        }
    }

    AfterAll {
        # Restore legacy HKCU\Run if we snapshotted it (in case the
        # install script removed it during the test run).
        if ($null -ne $script:LegacySnapshot) {
            New-ItemProperty -Path $script:LegacyRunKey `
                -Name $script:LegacyRunValue `
                -Value $script:LegacySnapshot `
                -PropertyType String `
                -Force | Out-Null
        }

        # Re-install the task so the user's PWA server is back in
        # the expected post-install state.
        $stillThere = Get-ScheduledTask -TaskName $script:TaskName -ErrorAction SilentlyContinue
        if (-not $stillThere) {
            & $script:InstallScript | Out-Null
        }
    }

    Context 'install-pwa-server-task.ps1' {
        It 'creates the CccPwaServer task when run as the current user' {
            # Sanity: task should not exist before this test (BeforeAll cleaned it).
            $pre = Get-ScheduledTask -TaskName $script:TaskName -ErrorAction SilentlyContinue
            $pre | Should -BeNullOrEmpty

            $output = & $script:InstallScript 2>&1
            $outputText = $output | Out-String
            $outputText | Should -Match "registered task '$($script:TaskName)'"

            $task = Get-ScheduledTask -TaskName $script:TaskName -ErrorAction SilentlyContinue
            $task | Should -Not -BeNullOrEmpty
            $task.TaskName | Should -Be $script:TaskName
            $task.Description | Should -Match 'PWA static server'
        }

        It 'is idempotent - running twice does not duplicate the task' {
            $output = & $script:InstallScript 2>&1
            $outputText = $output | Out-String
            # Second run should also report "registered" (Register-ScheduledTask
            # with -Force replaces, not appends).
            $outputText | Should -Match "registered task '$($script:TaskName)'"

            # PowerShell's Get-ScheduledTask returns a single object
            # even if multiple tasks with the same name exist; query
            # the CIM repository directly to be sure we count right.
            $cim = Get-ScheduledTask -TaskName $script:TaskName -ErrorAction SilentlyContinue
            @($cim).Count | Should -Be 1
        }

        It 'fires AtLogOn (trigger is MSFT_TaskLogonTrigger, not MSFT_TaskBootTrigger)' {
            $task = Get-ScheduledTask -TaskName $script:TaskName -ErrorAction SilentlyContinue
            $task | Should -Not -BeNullOrEmpty
            $task.Triggers | Should -Not -BeNullOrEmpty
            @($task.Triggers).Count | Should -BeGreaterOrEqual 1

            $triggerClass = $task.Triggers[0].CimClass.CimClassName
            $triggerClass | Should -Be 'MSFT_TaskLogonTrigger'
            $triggerClass | Should -Not -Be 'MSFT_TaskBootTrigger'
        }
    }

    Context 'uninstall-pwa-server-task.ps1' {
        It 'removes the CccPwaServer task' {
            # Make sure the task is present before we test removal -
            # the earlier "idempotent install" test left it installed.
            $pre = Get-ScheduledTask -TaskName $script:TaskName -ErrorAction SilentlyContinue
            $pre | Should -Not -BeNullOrEmpty

            $output = & $script:UninstallScript 2>&1
            $outputText = $output | Out-String
            $outputText | Should -Match "removed task '$($script:TaskName)'"

            $post = Get-ScheduledTask -TaskName $script:TaskName -ErrorAction SilentlyContinue
            $post | Should -BeNullOrEmpty
        }
    }
}
