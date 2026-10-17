Option Explicit
Dim desktopShell, desktopFs, desktopScript
Set desktopShell = CreateObject("WScript.Shell")
Set desktopFs = CreateObject("Scripting.FileSystemObject")
desktopScript = desktopFs.BuildPath(desktopFs.GetParentFolderName(WScript.ScriptFullName), "launch-desktop.ps1")
desktopShell.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -File """ & desktopScript & """", 0, False
