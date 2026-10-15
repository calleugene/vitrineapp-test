$ErrorActionPreference = 'Stop'
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
Set-Location $root
$destination = Join-Path $root ('.runtime/backups/' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $destination | Out-Null
$config = Get-Content .runtime/config.json -Raw | ConvertFrom-Json
$env:PGPASSWORD = $config.databasePassword
try {
    foreach ($db in @('vitrine_auth','vitrine_artifacts','vitrine_visitor')) {
        & .runtime/postgres/pgsql/bin/pg_dump.exe -h 127.0.0.1 -p 55432 -U vitrine -Fc -f "$destination/$db.dump" $db
        if ($LASTEXITCODE) { throw "Backup failed: $db" }
    }
    Copy-Item .runtime/config.json "$destination/config.json"
    Copy-Item .runtime/assets "$destination/assets" -Recurse
} finally { $env:PGPASSWORD = $null }
Write-Host "Backup saved: $destination"
