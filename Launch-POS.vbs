Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")

' Get the absolute path of the directory where this VBS script is located
scriptPath = FSO.GetParentFolderName(WScript.ScriptFullName)

' Construct the full path to the executable, ensuring the whole path is quoted
exePath = Chr(34) & scriptPath & "\Hardware-POS.exe" & Chr(34)

' Run the executable silently (0)
WshShell.Run exePath, 0, False

Set FSO = Nothing
Set WshShell = Nothing