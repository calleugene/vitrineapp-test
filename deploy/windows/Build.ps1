$ErrorActionPreference = 'Stop'
$root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
Push-Location $root
try {
    New-Item -ItemType Directory -Force .runtime/bin | Out-Null
    foreach ($service in @('auth-service', 'artifacts-service', 'visitor-service', 'analytics-service', 'dashboard-service', 'route-service', 'feedback-service', 'notification-service')) {
        Push-Location "Backend/$service"
        try {
            & go build -trimpath -o "../../.runtime/bin/$service.exe" .
            if ($LASTEXITCODE) { throw "Build failed: $service" }
        } finally { Pop-Location }
    }
    $env:VITE_AUTH_API_URL = '/api/auth'
    $env:VITE_ARTIFACTS_API_URL = '/api/artifacts'
    foreach ($name in @('ROUTE','DASHBOARD','ANALYTICS','FEEDBACK','NOTIFICATION')) {
        [Environment]::SetEnvironmentVariable("VITE_${name}_API_URL", "/api/$($name.ToLower())", 'Process')
    }
    Push-Location Frontend/MetodistPanel
    try {
        & npm.cmd ci --no-audit --no-fund
        if ($LASTEXITCODE) { throw 'Methodist install failed' }
        & npm.cmd run report:product
        if ($LASTEXITCODE) { throw 'Methodist updates report failed' }
        & npm.cmd run build -- --base=/methodist/
        if ($LASTEXITCODE) { throw 'Methodist build failed' }
    } finally { Pop-Location }
    $env:VITE_AUTH_API_URL = '/api/auth/api/v1'
    $env:VITE_ARTIFACTS_API_URL = '/api/artifacts/api/v1'
    $env:VITE_VISITOR_API_URL = '/api/visitor/api/v1'
    Push-Location Frontend/Visitor
    try {
        & npm.cmd ci --no-audit --no-fund
        if ($LASTEXITCODE) { throw 'Visitor install failed' }
        & npm.cmd run build
        if ($LASTEXITCODE) { throw 'Visitor build failed' }
    } finally { Pop-Location }
} finally { Pop-Location }
