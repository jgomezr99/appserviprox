$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$script = Join-Path $root 'servidor_api.ps1'
$taskName = 'Serviprox API'
$startup = [Environment]::GetFolderPath('Startup')

# Un acceso de Inicio que apunta a otra copia del proyecto arrancaria otra base de datos.
foreach ($link in Get-ChildItem -Path $startup -Filter '*.lnk' -ErrorAction SilentlyContinue) {
    $target = (New-Object -ComObject WScript.Shell).CreateShortcut($link.FullName).TargetPath
    if ($target -match 'iniciar_serviprox\.bat$' -and -not $target.StartsWith($root, [StringComparison]::OrdinalIgnoreCase)) {
        Rename-Item -Path $link.FullName -NewName ($link.Name + '.disabled') -Force
        Write-Output "Acceso desactivado (apuntaba a otra copia): $target"
    }
}

$arguments = "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$script`""
try {
    $action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $arguments -WorkingDirectory $root
    $trigger = New-ScheduledTaskTrigger -AtLogOn -User $env:USERNAME
    $settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries `
        -StartWhenAvailable -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) `
        -ExecutionTimeLimit ([TimeSpan]::Zero) -MultipleInstances IgnoreNew
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings `
        -Description 'Mantiene activa la API de Serviprox y su base SQLite.' -Force | Out-Null
    Start-ScheduledTask -TaskName $taskName
    Write-Output "Tarea programada '$taskName' registrada: la API inicia con tu sesion y se reinicia si falla."
} catch {
    # Sin permisos para tareas programadas: usar la carpeta Inicio del usuario.
    $shortcut = (New-Object -ComObject WScript.Shell).CreateShortcut((Join-Path $startup 'Serviprox API.lnk'))
    $shortcut.TargetPath = 'powershell.exe'
    $shortcut.Arguments = $arguments
    $shortcut.WorkingDirectory = $root
    $shortcut.WindowStyle = 7
    $shortcut.Save()
    Start-Process -FilePath 'powershell.exe' -ArgumentList $arguments -WindowStyle Hidden
    Write-Output "No se pudo crear la tarea programada ($($_.Exception.Message)). Se creo un acceso en Inicio."
}
Write-Output "Registro de la API: $(Join-Path $env:LOCALAPPDATA 'Serviprox\api.log')"
