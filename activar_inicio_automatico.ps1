$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$startup = [Environment]::GetFolderPath('Startup')
$shortcutPath = Join-Path $startup 'Serviprox.lnk'
$launcherPath = Join-Path $root 'iniciar_serviprox.bat'

$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $launcherPath
$shortcut.WorkingDirectory = $root
$shortcut.Description = 'Iniciar Serviprox'
$shortcut.Save()

Write-Output "Acceso creado: $shortcutPath"
