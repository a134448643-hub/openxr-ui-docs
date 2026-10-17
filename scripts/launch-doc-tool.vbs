Option Explicit

Dim shell, fileSystem, scriptDirectory, powerShellScript, command
Set shell = CreateObject("WScript.Shell")
Set fileSystem = CreateObject("Scripting.FileSystemObject")

scriptDirectory = fileSystem.GetParentFolderName(WScript.ScriptFullName)
powerShellScript = fileSystem.BuildPath(scriptDirectory, "launch-doc-tool.ps1")
command = "powershell.exe -NoProfile -ExecutionPolicy Bypass -File """ & powerShellScript & """"

shell.Run command, 0, False
