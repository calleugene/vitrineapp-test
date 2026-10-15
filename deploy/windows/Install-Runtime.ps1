$ErrorActionPreference = 'Stop'
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
Set-Location $root
New-Item -ItemType Directory -Force .runtime/downloads,.runtime/bin | Out-Null
if (!(Test-Path .runtime/bin/caddy.exe)) {
    $release = 'https://github.com/caddyserver/caddy/releases/download/v2.11.7'
    Invoke-WebRequest "$release/caddy_2.11.7_windows_amd64.zip" -OutFile .runtime/downloads/caddy.zip
    Invoke-WebRequest "$release/caddy_2.11.7_checksums.txt" -OutFile .runtime/downloads/caddy-checksums.txt
    $hash = (Get-FileHash .runtime/downloads/caddy.zip -Algorithm SHA512).Hash.ToLower()
    $line = Get-Content .runtime/downloads/caddy-checksums.txt | Where-Object { $_ -match 'caddy_2.11.7_windows_amd64.zip$' }
    if (!$line -or $line -notmatch $hash) { throw 'Caddy checksum mismatch' }
    Expand-Archive .runtime/downloads/caddy.zip .runtime/bin -Force
}
if (!(Test-Path .runtime/postgres/pgsql/bin/postgres.exe)) {
    # PostgreSQL 16.15 Windows x64 archive linked by the official EDB download page.
    Invoke-WebRequest 'https://sbp.enterprisedb.com/getfile.jsp?fileid=1260623' -OutFile .runtime/downloads/postgres.zip
    Expand-Archive .runtime/downloads/postgres.zip .runtime/postgres -Force
}
