$ErrorActionPreference = 'Stop'
foreach ($path in @('/','/methodist/','/api/visitor/healthz','/api/route/readyz','/api/feedback/readyz','/api/notification/readyz','/api/analytics/readyz','/api/dashboard/readyz','/api/artifacts/api/v1/public/museums/mus_001/artifacts')) {
    try {
        $response = Invoke-WebRequest "http://127.0.0.1$path" -UseBasicParsing -TimeoutSec 10
        Write-Host "$($response.StatusCode) $path"
    } catch { Write-Error "$path : $_" }
}
