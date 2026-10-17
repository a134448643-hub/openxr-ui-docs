$ErrorActionPreference = 'Stop'
$shortcutWorkspace = Split-Path -Parent $PSScriptRoot
$shortcutVersion = (Get-Content -LiteralPath (Join-Path $shortcutWorkspace 'package.json') -Raw | ConvertFrom-Json).version
if ($shortcutVersion -notmatch '^\d+\.\d+\.\d+$') { throw 'Unsupported release version.' }
$shortcutExe = Join-Path $shortcutWorkspace ".local\desktop-build\release\$shortcutVersion\PersonalDevPlatform-win32-x64\PersonalDevPlatform.exe"
if (-not (Test-Path -LiteralPath $shortcutExe)) { throw 'Build the desktop release first.' }
$shortcutShell = New-Object -ComObject WScript.Shell
foreach ($shortcutName in @('晓梦个人项目平台.lnk', '晓梦个人开发平台.lnk', '个人开发平台.lnk')) {
    $shortcutLink = $shortcutShell.CreateShortcut((Join-Path $shortcutWorkspace $shortcutName))
    $shortcutLink.TargetPath = $shortcutExe
    $shortcutLink.WorkingDirectory = $shortcutWorkspace
    $shortcutLink.IconLocation = "$shortcutExe,0"
    $shortcutLink.Description = '晓梦个人项目平台'
    $shortcutLink.Save()
}
$shortcutDesktop = [Environment]::GetFolderPath('DesktopDirectory')
if (-not [string]::IsNullOrWhiteSpace($shortcutDesktop)) {
    $shortcutDesktopLink = $shortcutShell.CreateShortcut((Join-Path $shortcutDesktop '晓梦个人项目平台.lnk'))
    $shortcutDesktopLink.TargetPath = $shortcutExe
    $shortcutDesktopLink.WorkingDirectory = $shortcutWorkspace
    $shortcutDesktopLink.IconLocation = "$shortcutExe,0"
    $shortcutDesktopLink.Description = '晓梦个人项目平台'
    $shortcutDesktopLink.Save()
}
Write-Output 'Desktop application shortcut ready.'
