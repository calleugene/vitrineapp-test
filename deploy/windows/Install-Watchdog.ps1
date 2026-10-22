$ErrorActionPreference = 'Stop'
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$binary = Join-Path $root 'VitrineServer.exe'
if (!(Test-Path $binary)) { throw 'Build VitrineServer.exe first' }
$user = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$action = New-ScheduledTaskAction -Execute $binary -Argument 'check' -WorkingDirectory $root
$timer = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(30) -RepetitionInterval (New-TimeSpan -Minutes 30)
$login = New-ScheduledTaskTrigger -AtLogOn -User $user
$principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 5)
Register-ScheduledTask -TaskName 'Vitrine Server Health' -Description 'Check Vitrine every 30 minutes and after login; recover failed local services.' -Action $action -Trigger @($timer,$login) -Principal $principal -Settings $settings -Force | Out-Null
Start-ScheduledTask -TaskName 'Vitrine Server Health'
Get-ScheduledTask -TaskName 'Vitrine Server Health' | Select-Object TaskName,State
