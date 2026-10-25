@echo off
setlocal
title Serviprox
cd /d "%~dp0"

call "%~dp0backend\start_local.bat"
if errorlevel 1 exit /b 1

echo Frontend: http://localhost:8100/
call npm.cmd run dev
set "serviproxExitCode=%errorlevel%"
endlocal & exit /b %serviproxExitCode%
