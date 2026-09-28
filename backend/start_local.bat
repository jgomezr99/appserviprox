@echo off
setlocal
cd /d "%~dp0"

echo ======================================================
echo    SERVIPROX - INICIANDO BACKEND Y BASE DE DATOS
echo ======================================================

if not exist ".venv\Scripts\python.exe" (
  echo [1/4] Creando entorno virtual Python...
  py -3.13 -m venv .venv 2>nul || py -3 -m venv .venv 2>nul || python -m venv .venv
  if errorlevel 1 (
    echo ERROR: No se pudo crear el entorno virtual. Asegurate de tener Python instalado.
    pause
    exit /b 1
  )
)

call ".venv\Scripts\activate.bat"
set "SERVIPROX_DATABASE=sqlite"

:: Solo instalar dependencias si Django no esta presente o si se solicita explicitamente
python -c "import django" >nul 2>&1
if errorlevel 1 (
  echo [2/4] Instalando dependencias de Serviprox (primera ejecucion)...
  python -m pip install -r requirements.txt
  if errorlevel 1 (
    echo ERROR: Fallo la instalacion de dependencias.
    pause
    exit /b 1
  )
) else (
  echo [2/4] Dependencias de Python verificadas OK.
)

echo [3/4] Verificando base de datos SQLite y migraciones...
python manage.py migrate --no-input
if errorlevel 1 (
  echo ERROR: Fallo la migracion de base de datos.
  pause
  exit /b 1
)

findstr /B "EMAIL_HOST=" "%~dp0..\.env" >nul 2>&1
if errorlevel 1 (
  echo AVISO: Los correos de recuperacion saldran en consola (no hay SMTP configurado).
)

echo [4/4] Verificando datos demo de la base de datos...
python seed_demo.py >nul 2>&1

echo.
echo ======================================================
echo Base de datos conectada: SQLite (Modo WAL de alta velocidad)
echo API Backend escuchando en: http://127.0.0.1:8000/
echo Salud de base de datos en: http://127.0.0.1:8000/api/v1/health/
echo ======================================================
echo.

python manage.py runserver 0.0.0.0:8000
