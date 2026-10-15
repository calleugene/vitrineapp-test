param([switch]$Public)
$ErrorActionPreference = 'Stop'
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
Set-Location $root
$runtime = Join-Path $root '.runtime'
$config = Get-Content "$runtime/config.json" -Raw | ConvertFrom-Json
$pg = "$runtime/postgres/pgsql/bin"
$env:PGPASSWORD = $config.databasePassword
& "$pg/pg_ctl.exe" status -D "$runtime/pgdata" *> $null
if ($LASTEXITCODE -ne 0) {
    & "$pg/pg_ctl.exe" start -D "$runtime/pgdata" -l "$runtime/logs/postgres.log" -w
    if ($LASTEXITCODE) { throw 'PostgreSQL startup failed' }
}
$env:AUTH_TOKEN_SECRET = $config.tokenSecret
$env:AUTH_DB_DSN = "postgresql://vitrine:$($config.databasePassword)@127.0.0.1:55432/vitrine_auth?sslmode=disable"
$env:AUTH_HTTP_ADDR = '127.0.0.1:18080'
$env:ARTIFACTS_DB_DSN = "postgresql://vitrine:$($config.databasePassword)@127.0.0.1:55432/vitrine_artifacts?sslmode=disable"
$env:ARTIFACTS_HTTP_ADDR = '127.0.0.1:18081'
$env:ARTIFACTS_TOKEN_SECRET = $config.tokenSecret
$env:ARTIFACTS_ASSET_DIR = "$runtime/assets"
$env:ARTIFACTS_ASSET_PUBLIC_URL = '/media-files'
$env:ARTIFACTS_PUBLIC_BASE_URL = if ($Public) { 'https://vitrineapp.ru' } else { $config.localUrl }
$env:DB_DSN = "postgresql://vitrine:$($config.databasePassword)@127.0.0.1:55432/vitrine_visitor?sslmode=disable"
$env:PORT = '127.0.0.1:18088'
$env:AUTH_SERVICE_URL = 'http://127.0.0.1:18080/api/v1'
$env:SITE_ADDRESS = if ($Public) { 'vitrineapp.ru' } else { 'http://:80' }
$env:XDG_DATA_HOME = "$runtime/caddy-data"
$env:XDG_CONFIG_HOME = "$runtime/caddy-config"
& "$runtime/bin/caddy.exe" validate --config deploy/windows/Caddyfile --adapter caddyfile
if ($LASTEXITCODE) { throw 'Caddy configuration invalid' }
foreach ($name in @('auth-service','artifacts-service','visitor-service','caddy')) {
    $exe = [IO.Path]::GetFullPath("$runtime/bin/$name.exe")
    $existing = Get-Process -Name $name -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $exe }
    if ($existing) { continue }
    $arguments = if ($name -eq 'caddy') { @('run','--config','deploy/windows/Caddyfile','--adapter','caddyfile') } else { @() }
    $parameters = @{
        FilePath = $exe; WorkingDirectory = $root; WindowStyle = 'Hidden'; PassThru = $true
        RedirectStandardOutput = "$runtime/logs/$name.out.log"
        RedirectStandardError = "$runtime/logs/$name.err.log"
    }
    if ($arguments.Count) { $parameters.ArgumentList = $arguments }
    $process = Start-Process @parameters
    $process.Id | Set-Content "$runtime/$name.pid"
}
$env:PGPASSWORD = $null
Write-Host 'Started. Run deploy/windows/Status.ps1 to verify readiness.'
