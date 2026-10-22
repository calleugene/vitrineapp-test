$ErrorActionPreference = 'Stop'
Push-Location "$PSScriptRoot/launcher"
try {
    & go build -trimpath -ldflags='-s -w -H=windowsgui' -o ../../../VitrineServer.exe .
    if ($LASTEXITCODE) { throw 'Launcher build failed' }
} finally { Pop-Location }
