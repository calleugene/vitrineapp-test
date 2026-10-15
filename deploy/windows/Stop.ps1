$ErrorActionPreference = 'Stop'
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$runtime = Join-Path $root '.runtime'
foreach ($name in @('caddy','visitor-service','artifacts-service','auth-service')) {
    $exe = [IO.Path]::GetFullPath("$runtime/bin/$name.exe")
    Get-Process -Name $name -ErrorAction SilentlyContinue | Where-Object { $_.Path -eq $exe } | Stop-Process
}
& "$runtime/postgres/pgsql/bin/pg_ctl.exe" stop -D "$runtime/pgdata" -m fast -w
