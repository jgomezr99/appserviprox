@echo off
setlocal
cd /d "%~dp0.."
if not exist ".env" (
  echo Falta .env. Copia .env.example y configura PostgreSQL antes de iniciar.
  exit /b 1
)
docker compose -f docker-compose.yml up -d db backend
if errorlevel 1 exit /b 1
docker compose -f docker-compose.yml exec -T backend python manage.py migrate --noinput
if errorlevel 1 exit /b 1
echo Backend PostgreSQL: http://localhost:8000/api/v1/
endlocal
