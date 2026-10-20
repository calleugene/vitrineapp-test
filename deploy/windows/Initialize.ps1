$ErrorActionPreference = 'Stop'
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
Set-Location $root
if (Test-Path .runtime/pgdata/PG_VERSION) { throw 'Database already initialized; use Start.ps1' }
New-Item -ItemType Directory -Force .runtime/logs,.runtime/assets | Out-Null
if (!(Test-Path .runtime/config.json)) {
    $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
    $bytes = New-Object byte[] 48
    $rng.GetBytes($bytes)
    $secret = [BitConverter]::ToString($bytes).Replace('-','').ToLower()
    $rng.GetBytes($bytes)
    $password = [BitConverter]::ToString($bytes).Replace('-','').ToLower()
    $rng.Dispose()
    @{databasePassword=$password; tokenSecret=$secret; localUrl='http://192.168.31.125'} |
        ConvertTo-Json | Set-Content .runtime/config.json
}
$config = Get-Content .runtime/config.json -Raw | ConvertFrom-Json
# Local password file and config are ignored by Git.
$config.databasePassword | Set-Content .runtime/postgres-password.txt -NoNewline
& .runtime/postgres/pgsql/bin/initdb.exe -D .runtime/pgdata -U vitrine -A scram-sha-256 --pwfile=.runtime/postgres-password.txt --encoding=UTF8 --locale=C
if ($LASTEXITCODE) { throw 'initdb failed' }
Add-Content .runtime/pgdata/postgresql.conf "`nlisten_addresses = '127.0.0.1'`nport = 55432`n"
& .runtime/postgres/pgsql/bin/pg_ctl.exe start -D .runtime/pgdata -l .runtime/logs/postgres.log -w
if ($LASTEXITCODE) { throw 'PostgreSQL startup failed' }
$env:PGPASSWORD = $config.databasePassword
try {
    foreach ($db in @('vitrine_auth','vitrine_artifacts','vitrine_visitor','vitrine_analytics','vitrine_route','vitrine_feedback','vitrine_notification')) {
        & .runtime/postgres/pgsql/bin/createdb.exe -h 127.0.0.1 -p 55432 -U vitrine $db
        if ($LASTEXITCODE) { throw "createdb failed: $db" }
    }
} finally { $env:PGPASSWORD = $null }
