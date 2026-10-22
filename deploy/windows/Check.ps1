param([switch]$Force)
$ErrorActionPreference = 'Stop'
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
Set-Location $root
$runtime = Join-Path $root '.runtime'
$mutex = New-Object Threading.Mutex($false, 'Local\VitrineServerHealth')
$locked = $false
try {
    try { $locked = $mutex.WaitOne(0) } catch [Threading.AbandonedMutexException] { $locked = $true }
    if (!$locked) { exit 0 }
    if ((Test-Path "$runtime/maintenance") -and !$Force) { exit 0 }
    $log = "$runtime/logs/watchdog.log"
    function Log($message) { Add-Content $log ("{0:o} {1}" -f (Get-Date), $message) }
    function Healthy($url, $expected = 200) {
        try {
            $response = Invoke-WebRequest $url -UseBasicParsing -TimeoutSec 5
            return [int]$response.StatusCode -eq $expected
        } catch {
            if ($_.Exception.Response) { return [int]$_.Exception.Response.StatusCode -eq $expected }
            return $false
        }
    }
    $targets = @(
        @{name='auth-service'; url='http://127.0.0.1:18080/api/v1/auth/me'; code=401},
        @{name='artifacts-service'; url='http://127.0.0.1:18081/api/v1/public/museums/mus_001/artifacts'; code=200},
        @{name='visitor-service'; url='http://127.0.0.1:18088/healthz'; code=200},
        @{name='analytics-service'; url='http://127.0.0.1:18085/readyz'; code=200},
        @{name='dashboard-service'; url='http://127.0.0.1:18084/readyz'; code=200},
        @{name='route-service'; url='http://127.0.0.1:18083/readyz'; code=200},
        @{name='feedback-service'; url='http://127.0.0.1:18086/readyz'; code=200},
        @{name='notification-service'; url='http://127.0.0.1:18087/readyz'; code=200},
        @{name='caddy'; url='http://127.0.0.1/'; code=200}
    )
    & "$runtime/postgres/pgsql/bin/pg_isready.exe" -h 127.0.0.1 -p 55432 -U vitrine *> $null
    if ($LASTEXITCODE -ne 0) {
        Log 'PostgreSQL unavailable; attempting recovery'
        & "$runtime/postgres/pgsql/bin/pg_ctl.exe" status -D "$runtime/pgdata" *> $null
        if ($LASTEXITCODE -eq 0) {
            & "$runtime/postgres/pgsql/bin/pg_ctl.exe" restart -D "$runtime/pgdata" -l "$runtime/logs/postgres.log" -m fast -w
            if ($LASTEXITCODE) { throw 'PostgreSQL recovery failed' }
        }
    }
    foreach ($target in $targets) {
        if (!(Healthy $target.url $target.code)) {
            Log ("Unhealthy: " + $target.name)
            $exe = [IO.Path]::GetFullPath("$runtime/bin/$($target.name).exe")
            Get-Process -Name $target.name -ErrorAction SilentlyContinue |
                Where-Object { $_.Path -eq $exe } | Stop-Process
        }
    }
    & "$root/deploy/windows/Start.ps1"
    $ready = $false
    for ($attempt = 0; $attempt -lt 20; $attempt++) {
        $failed = @($targets | Where-Object { !(Healthy $_.url $_.code) })
        if (!$failed.Count -and (Healthy 'http://127.0.0.1/methodist/')) { $ready = $true; break }
        Start-Sleep -Seconds 1
    }
    if (!$ready) { throw ('Recovery incomplete: ' + (($failed | ForEach-Object name) -join ', ')) }
    Log 'OK: both frontends and all eight available APIs are responding'
} catch {
    if ($log) { Log ("FAILED: " + $_.Exception.Message) }
    Write-Error $_
    exit 1
} finally {
    if ($locked) { $mutex.ReleaseMutex() }
    $mutex.Dispose()
}

