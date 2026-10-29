$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$python = Join-Path $root '.venv\Scripts\python.exe'
$manage = Join-Path $root 'backend\manage.py'
$logDir = Join-Path $env:LOCALAPPDATA 'Serviprox'
$log = Join-Path $logDir 'api.log'

New-Item -ItemType Directory -Path $logDir -Force | Out-Null
if (-not (Test-Path $python)) { throw "No existe $python. Crea el entorno virtual en la raiz del proyecto." }

$env:SERVIPROX_DATABASE = 'sqlite'
$env:SERVIPROX_MEDIA_STORAGE = 'filesystem'
$env:PYTHONUNBUFFERED = '1'

while ($true) {
    # Si ya hay una API escuchando en el puerto 8000 no se inicia otra.
    $busy = Get-NetTCPConnection -LocalPort 8000 -State Listen -ErrorAction SilentlyContinue
    if (-not $busy) {
        "[$(Get-Date -Format s)] Iniciando API Serviprox (SQLite)" | Out-File -FilePath $log -Append -Encoding utf8
        & $python $manage migrate --no-input 2>&1 | Out-File -FilePath $log -Append -Encoding utf8
        & $python $manage runserver 0.0.0.0:8000 --noreload 2>&1 | Out-File -FilePath $log -Append -Encoding utf8
        "[$(Get-Date -Format s)] La API se detuvo; reintentando en 10 segundos" | Out-File -FilePath $log -Append -Encoding utf8
    }
    Start-Sleep -Seconds 10
}
