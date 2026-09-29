@echo off
setlocal
cd /d "%~dp0"

powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0activar_inicio_automatico.ps1"
if errorlevel 1 (
  echo No se pudo activar el inicio automatico.
  pause
  exit /b 1
)

echo Serviprox se iniciara automaticamente al entrar a Windows.
pause
endlocal
