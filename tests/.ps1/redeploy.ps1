# tests/redeploy.ps1
param(
    [string]$Project = "uteklinker-chatbot-vercel",
    [string]$Scope   = "christians-projects-2b13c2b9"
)

function Log($msg) {
    Write-Host "[$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')] $msg"
}

Log "=== Redeploy startar för projekt: $Project (scope=$Scope) ==="
$ProjectRoot = (Resolve-Path "$PSScriptRoot\..").Path
Log "Projektrot: $ProjectRoot"

# Ta bort gamla deployments
Log "Tar bort gamla deployments..."
$rmOutput = vercel rm $Project --scope=$Scope --safe --yes 2>&1
if ($LASTEXITCODE -ne 0) {
    Log "Fel vid borttagning av gamla deployments: $rmOutput"
} else {
    Log "Gamla deployments borttagna."
}

# Starta ny deployment med clear cache
Log "Startar ny deployment med --force (clear cache)..."
$deployOutput = vercel deploy $ProjectRoot --prod --force --scope=$Scope 2>&1

if ($LASTEXITCODE -ne 0) {
    Log "❌ Fel vid ny deployment: $deployOutput"
    exit 1
} else {
    $shortDeployOutput = ($deployOutput -join "`n")
    if ($shortDeployOutput.Length -gt 500) {
        $shortDeployOutput = $shortDeployOutput.Substring(0, 500) + "...[truncated]"
    }
    Log "✅ Ny deployment skapad:"
    Log $shortDeployOutput
    
    # Lägg till direktlänk till prod-URL
    $prodUrl = "https://$Project.vercel.app"
    Log "🌍 Prod URL: $prodUrl"

    # Öppna Chrome automatiskt
    try {
        Start-Process "chrome.exe" $prodUrl
        Log "🚀 Öppnade $prodUrl i Chrome."
    } catch {
        Log "⚠️ Kunde inte öppna Chrome automatiskt. Du kan själv öppna: $prodUrl"
    }
}

Log "=== Redeploy klart ==="
