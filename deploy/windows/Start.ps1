param([switch]$Public)
$ErrorActionPreference = 'Stop'
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
Set-Location $root
$runtime = Join-Path $root '.runtime'
if (Test-Path "$runtime/maintenance") { Remove-Item -LiteralPath "$runtime/maintenance" }
$config = Get-Content "$runtime/config.json" -Raw | ConvertFrom-Json
$pg = "$runtime/postgres/pgsql/bin"
$env:PGPASSWORD = $config.databasePassword
& "$pg/pg_ctl.exe" status -D "$runtime/pgdata" *> $null
if ($LASTEXITCODE -ne 0) {
    & "$pg/pg_ctl.exe" start -D "$runtime/pgdata" -l "$runtime/logs/postgres.log" -w
    if ($LASTEXITCODE) { throw 'PostgreSQL startup failed' }
}
# SMTP credentials stay in the ignored server runtime config, never frontend builds.
foreach ($entry in @{
    AUTH_SMTP_ADDR = 'smtpAddress'; AUTH_SMTP_USER = 'smtpUser';
    AUTH_SMTP_PASSWORD = 'smtpPassword'; AUTH_MAIL_FROM = 'mailFrom';
    AUTH_PUBLIC_URL = 'authPublicUrl'; AUTH_SMTP_TLS_MAX_VERSION = 'smtpTLSMaxVersion'
}.GetEnumerator()) {
    $value = $config.PSObject.Properties[$entry.Value]
    if ($value -and $value.Value) { [Environment]::SetEnvironmentVariable($entry.Key, [string]$value.Value, 'Process') }
}
if ($config.PSObject.Properties['smtpPasswordProtected'] -and $config.smtpPasswordProtected) {
    $smtpSecret = ConvertTo-SecureString $config.smtpPasswordProtected
    $smtpPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($smtpSecret)
    try { $env:AUTH_SMTP_PASSWORD = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($smtpPointer) }
    finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($smtpPointer); $smtpSecret.Dispose() }
}
$env:AUTH_TOKEN_SECRET = $config.tokenSecret
# Upgrade existing installations as well as freshly initialized databases.
foreach ($dbName in @('vitrine_analytics','vitrine_route','vitrine_feedback','vitrine_notification')) {
    $exists = & "$pg/psql.exe" -h 127.0.0.1 -p 55432 -U vitrine -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$dbName'"
    if ($LASTEXITCODE) { throw "Cannot inspect database: $dbName" }
    if (("$exists").Trim() -ne '1') {
        & "$pg/createdb.exe" -h 127.0.0.1 -p 55432 -U vitrine $dbName
        if ($LASTEXITCODE) { throw "Cannot create database: $dbName" }
    }
}
$env:ROUTE_DB_DSN = "postgresql://vitrine:$($config.databasePassword)@127.0.0.1:55432/vitrine_route?sslmode=disable"
$env:ROUTE_HTTP_ADDR = '127.0.0.1:18083'
$env:FEEDBACK_DB_DSN = "postgresql://vitrine:$($config.databasePassword)@127.0.0.1:55432/vitrine_feedback?sslmode=disable"
$env:FEEDBACK_HTTP_ADDR = '127.0.0.1:18086'
$env:NOTIFICATION_DB_DSN = "postgresql://vitrine:$($config.databasePassword)@127.0.0.1:55432/vitrine_notification?sslmode=disable"
$env:NOTIFICATION_HTTP_ADDR = '127.0.0.1:18087'
$env:ROUTE_ARTIFACTS_DB_DSN = "postgresql://vitrine:$($config.databasePassword)@127.0.0.1:55432/vitrine_artifacts?sslmode=disable"
$env:ARTIFACTS_SERVICE_URL = 'http://127.0.0.1:18081/api/v1'
$env:ROUTE_SERVICE_URL = 'http://127.0.0.1:18083/api/v1'
$env:FEEDBACK_SERVICE_URL = 'http://127.0.0.1:18086/api/v1'
$env:DASHBOARD_ROUTE_URL = 'http://127.0.0.1:18083'
$env:DASHBOARD_FEEDBACK_URL = 'http://127.0.0.1:18086'
$env:ANALYTICS_DB_DSN = "postgresql://vitrine:$($config.databasePassword)@127.0.0.1:55432/vitrine_analytics?sslmode=disable"
$env:ANALYTICS_ROUTE_URL = 'http://127.0.0.1:18083/api/v1'
$env:ANALYTICS_FEEDBACK_URL = 'http://127.0.0.1:18086/api/v1'
$env:ANALYTICS_HTTP_ADDR = '127.0.0.1:18085'
$env:ANALYTICS_TOKEN_SECRET = $config.tokenSecret
$env:ANALYTICS_ARTIFACTS_DB_DSN = "postgresql://vitrine:$($config.databasePassword)@127.0.0.1:55432/vitrine_artifacts?sslmode=disable"
$env:ANALYTICS_ARTIFACTS_URL = 'http://127.0.0.1:18081/api/v1'
$env:ANALYTICS_AUTH_URL = 'http://127.0.0.1:18080/api/v1'
$env:DASHBOARD_HTTP_ADDR = '127.0.0.1:18084'
$env:DASHBOARD_ANALYTICS_URL = 'http://127.0.0.1:18085'
$env:AUTH_DB_DSN = "postgresql://vitrine:$($config.databasePassword)@127.0.0.1:55432/vitrine_auth?sslmode=disable"
$env:AUTH_HTTP_ADDR = '127.0.0.1:18080'
if (-not $env:AUTH_TRUSTED_PROXY_CIDRS) { $env:AUTH_TRUSTED_PROXY_CIDRS = '127.0.0.1/32,::1/128' }
$env:MUSEUM_SERVICE_URL = 'http://127.0.0.1:18081/api/v1'
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
foreach ($name in @('auth-service','artifacts-service','visitor-service','route-service','feedback-service','notification-service','analytics-service','dashboard-service','caddy')) {
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
