Option Explicit
Dim managerShell, managerFs, managerScript, managerCommand
Set managerShell = CreateObject("WScript.Shell")
Set managerFs = CreateObject("Scripting.FileSystemObject")
managerScript = managerFs.BuildPath(managerFs.GetParentFolderName(WScript.ScriptFullName), "launch-ue-manager.ps1")
managerCommand = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File """ & managerScript & """"
managerShell.Run managerCommand, 0, False
