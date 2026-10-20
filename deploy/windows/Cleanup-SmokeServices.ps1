param([Parameter(Mandatory=$true)][string]$Marker)
$ErrorActionPreference='Stop'
if ($Marker -notmatch '^smoke-[a-f0-9]{32}$') { throw 'Invalid smoke marker' }
$root=Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
Set-Location $root
$config=Get-Content .runtime/config.json -Raw | ConvertFrom-Json
$env:PGPASSWORD=$config.databasePassword
try {
 foreach ($database in @('vitrine_route','vitrine_feedback','vitrine_notification')) {
  $sql="BEGIN; DELETE FROM records WHERE kind='visit' AND body::jsonb->>'route_id' IN (SELECT id FROM records WHERE kind='route' AND body LIKE '%$Marker%'); DELETE FROM notification_reads WHERE notification_id IN (SELECT id FROM records WHERE body LIKE '%$Marker%'); DELETE FROM records WHERE body LIKE '%$Marker%'; DELETE FROM events WHERE title LIKE '%$Marker%'; COMMIT;"
  & .runtime/postgres/pgsql/bin/psql.exe -v ON_ERROR_STOP=1 -h 127.0.0.1 -p 55432 -U vitrine -d $database -c $sql | Out-Null
  if($LASTEXITCODE){throw "Cleanup failed: $database"}
 }
 & .runtime/postgres/pgsql/bin/psql.exe -v ON_ERROR_STOP=1 -h 127.0.0.1 -p 55432 -U vitrine -d vitrine_artifacts -c "DELETE FROM artifact_visitor_status WHERE visitor_id='$Marker'" | Out-Null
 if($LASTEXITCODE){throw 'Collection cleanup failed'}
 & .runtime/postgres/pgsql/bin/psql.exe -v ON_ERROR_STOP=1 -h 127.0.0.1 -p 55432 -U vitrine -d vitrine_auth -c "DELETE FROM users WHERE email='$Marker@example.invalid'" | Out-Null
 if($LASTEXITCODE){throw 'Account cleanup failed'}
} finally {$env:PGPASSWORD=$null}
Write-Output 'PASS smoke fixtures cleaned'

