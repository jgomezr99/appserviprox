@echo off
setlocal
cd /d "%~dp0.."
echo Serviprox utiliza Django y PostgreSQL dentro de Docker.
docker compose -f docker-compose.yml start db backend
set "serviproxExitCode=%errorlevel%"
if not "%serviproxExitCode%"=="0" echo Abre Docker Desktop y verifica los contenedores existentes.
endlocal & exit /b %serviproxExitCode%
