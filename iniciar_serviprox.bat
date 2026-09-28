@echo off
setlocal enabledelayedexpansion
title Serviprox - Servidor Completo
cd /d "%~dp0"

echo =======================================================
echo          SERVIPROX - INICIANDO SISTEMA
echo =======================================================
echo.
echo 1. Iniciando Backend Django y Base de Datos (Puerto 8000)...
start "Serviprox Backend (Django :8000)" cmd /k "cd /d "%~dp0backend" && start_local.bat"

echo 2. Iniciando Frontend Web y Movil (Puerto 8100)...
start "Serviprox Frontend (Vite :8100)" cmd /k "cd /d "%~dp0" && npm.cmd run dev"

echo.
echo =======================================================
echo Serviprox se esta ejecutando:
echo   - Web en tu PC:        http://localhost:8100/
echo   - Movil en tu Wi-Fi:   http://192.168.0.6:8100/
echo   - Backend API:         http://localhost:8000/api/v1/
echo   - Administrador DB:    http://localhost:8000/admin/
echo =======================================================
echo.
echo Deja abiertas las ventanas negras del backend y frontend
echo para que la base de datos siempre guarde los datos.
echo.
pause
endlocal