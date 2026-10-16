@echo off
setlocal
title Serviprox - Docker
cd /d "%~dp0"
echo Iniciando los contenedores existentes de Serviprox...
docker compose -f docker-compose.yml start db backend
if errorlevel 1 (
  echo No se pudieron iniciar los contenedores. Abre Docker Desktop y revisa docker compose ps -a.
  echo Este lanzador no crea entornos Python ni construye imagenes.
  pause
  exit /b 1
)
echo Frontend: http://localhost:8100/
call npm.cmd run dev
set "serviproxExitCode=%errorlevel%"
endlocal & exit /b %serviproxExitCode%
