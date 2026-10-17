$ErrorActionPreference = 'Stop'
$desktopWorkspace = Split-Path -Parent $PSScriptRoot
$desktopNode = (Get-Command node.exe -ErrorAction Stop).Source
$desktopLaunchScript = Join-Path $PSScriptRoot 'run-desktop.mjs'
if (-not (Test-Path -LiteralPath (Join-Path $desktopWorkspace 'desktop\build\manager.html'))) { throw '桌面资源未构建，请先运行 npm run desktop:build。' }
Start-Process -FilePath $desktopNode -ArgumentList @('"' + $desktopLaunchScript + '"') -WorkingDirectory $desktopWorkspace -WindowStyle Hidden
