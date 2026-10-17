param([string]$OpenUrl = 'http://127.0.0.1:5173/')
$ErrorActionPreference = 'Stop'

$appRoot = Split-Path -Parent $PSScriptRoot
$toolUrl = $OpenUrl
$healthUrl = 'http://127.0.0.1:5173/api/workspace'
$localRoot = Join-Path $appRoot '.local'
$launcherLog = Join-Path $localRoot 'launcher.log'

[System.IO.Directory]::CreateDirectory($localRoot) | Out-Null

function Write-LauncherLog([string]$message) {
    $timestamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss.fff'
    Add-Content -LiteralPath $launcherLog -Value "[$timestamp] $message" -Encoding UTF8
}

function Show-LauncherError([string]$message) {
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show(
        $message,
        'Documentation Tool',
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Error
    ) | Out-Null
}

function Test-DocumentTool {
    try {
        $response = Invoke-WebRequest -UseBasicParsing -Uri $healthUrl -TimeoutSec 1
        return $response.StatusCode -eq 200
    }
    catch {
        return $false
    }
}

try {
    Write-LauncherLog 'Launcher started.'

    if (-not (Test-DocumentTool)) {
        Write-LauncherLog 'Local server is not ready; starting npm run dev.'
        $npmCommand = (Get-Command npm.cmd -ErrorAction Stop).Source
        Start-Process -FilePath $npmCommand `
            -ArgumentList @('run', 'dev', '--', '--strictPort') `
            -WorkingDirectory $appRoot `
            -WindowStyle Hidden

        $ready = $false
        for ($attempt = 0; $attempt -lt 80; $attempt++) {
            Start-Sleep -Milliseconds 250
            if (Test-DocumentTool) {
                $ready = $true
                break
            }
        }

        if (-not $ready) {
            throw 'Startup timed out. Make sure Node.js and npm are installed and port 5173 is available.'
        }
        Write-LauncherLog 'Local server is ready.'
    }
    else {
        Write-LauncherLog 'Local server was already running.'
    }

    Start-Process -FilePath "$env:WINDIR\explorer.exe" -ArgumentList $toolUrl
    Write-LauncherLog "Opened $toolUrl"
}
catch {
    Write-LauncherLog "ERROR: $($_.Exception.Message)"
    Show-LauncherError "Unable to open the documentation tool.`n`n$($_.Exception.Message)`n`nLauncher log: $launcherLog"
    exit 1
}
