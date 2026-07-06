# dev-start.ps1
# Auto-detects the current LAN IP, updates CRM_LOCAL_HOST in .env, then starts Docker.
# Usage: .\dev-start.ps1           -> docker compose up -d
#        .\dev-start.ps1 --logs    -> docker compose up (streaming logs)

$EnvFile = Join-Path $PSScriptRoot ".env"

# Find the LAN IP via the adapter that has a default gateway (real network, not virtual)
$ip = $null
try {
    $cfg = Get-NetIPConfiguration | Where-Object { $_.IPv4DefaultGateway -ne $null } | Select-Object -First 1
    if ($cfg) { $ip = $cfg.IPv4Address.IPAddress }
} catch { }

if (-not $ip) {
    Write-Warning "Could not detect LAN IP. CRM_LOCAL_HOST not updated."
} else {
    $content = Get-Content $EnvFile -Raw
    $newContent = [regex]::Replace($content, 'CRM_LOCAL_HOST=\S+', "CRM_LOCAL_HOST=$ip")
    if ($newContent -ne $content) {
        [System.IO.File]::WriteAllText($EnvFile, $newContent)
        Write-Host "CRM_LOCAL_HOST updated to $ip" -ForegroundColor Cyan
    } else {
        Write-Host "CRM_LOCAL_HOST=$ip (no change)" -ForegroundColor Gray
    }
}

if ($args -contains "--logs") {
    docker compose up
} else {
    docker compose up -d
    Write-Host "Started. Logs: docker compose logs -f server" -ForegroundColor Green
}
