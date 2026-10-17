$ErrorActionPreference = 'Stop'
$managerWorkspace = Split-Path -Parent $PSScriptRoot
$managerUrl = 'http://127.0.0.1:8771/ue-ai-devmanager-updated.html'
$managerPreviewReady = $false
try { $managerPreviewReady = (Invoke-WebRequest -Uri $managerUrl -UseBasicParsing -TimeoutSec 2).StatusCode -eq 200 } catch {}
if (-not $managerPreviewReady) {
    $managerNode = (Get-Command node.exe -ErrorAction Stop).Source
    $managerServerScript = Join-Path $PSScriptRoot 'ue-manager-preview.mjs'
    Start-Process -FilePath $managerNode -ArgumentList @('"' + $managerServerScript + '"') -WorkingDirectory $managerWorkspace -WindowStyle Hidden
    for ($managerAttempt = 0; $managerAttempt -lt 40; $managerAttempt++) {
        Start-Sleep -Milliseconds 250
        try { $managerPreviewReady = (Invoke-WebRequest -Uri $managerUrl -UseBasicParsing -TimeoutSec 1).StatusCode -eq 200 } catch {}
        if ($managerPreviewReady) { break }
    }
    if (-not $managerPreviewReady) { throw '项目管理器启动失败，请检查本机 8771 端口。' }
}
& (Join-Path $PSScriptRoot 'launch-doc-tool.ps1') -OpenUrl $managerUrl
