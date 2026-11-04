$ErrorActionPreference = 'Stop'
$repoRoot = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
if (!(Test-Path -LiteralPath (Join-Path $repoRoot '.local/secrets/backup-export'))) {
    throw 'Prepare the server-authorized backup-only SSH key first.'
}
$userId = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name
$action = New-ScheduledTaskAction -Execute (Get-Command pwsh).Source -Argument ('-NoProfile -NonInteractive -File "' + (Join-Path $PSScriptRoot 'pull-backups.ps1') + '"')
$triggers = @(
    New-ScheduledTaskTrigger -Daily -At '09:00'
    New-ScheduledTaskTrigger -AtLogOn -User $userId
)
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 10) -MultipleInstances IgnoreNew
$principal = New-ScheduledTaskPrincipal -UserId $userId -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName 'Codelily-Encrypted-Backup-Pull' -Action $action -Trigger $triggers -Settings $settings -Principal $principal -Description 'Pull ciphertext only through forced-command SSH; verify SHA256; retain 7 days.' -Force | Select-Object TaskName, State
