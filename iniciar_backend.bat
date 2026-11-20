@echo off
title Serviprox - Servidor Django Local (SQLite)
echo ========================================================
echo  Iniciando Servidor Backend Serviprox con SQLite Local
echo ========================================================
echo.
cd /d "%~dp0backend"

if not exist ".venv\Scripts\python.exe" (
    echo [ERROR] No se encontro el entorno virtual en backend\.venv.
    echo Asegurate de que el entorno virtual exista.
    pause
    exit /b 1
)

echo Base de datos: backend\db.sqlite3
echo Servidor API:  http://127.0.0.1:8000/api/v1
echo.
echo Presiona Ctrl+C para detener el servidor.
echo ========================================================
echo.
.\.venv\Scripts\python.exe manage.py runserver 127.0.0.1:8000
pause
