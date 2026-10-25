@echo off
setlocal
title Serviprox
cd /d "%~dp0"

if /I "%~1"=="docker" (
  call "%~dp0backend\start_local.bat" docker
  if errorlevel 1 exit /b 1
) else (
  echo Iniciando Django y SQLite en modo local...
  start "Serviprox Backend" /min cmd /k call "%~dp0backend\start_local.bat"
)

echo Frontend: http://localhost:8100/
call npm.cmd run dev
set "serviproxExitCode=%errorlevel%"
endlocal & exit /b %serviproxExitCode%
