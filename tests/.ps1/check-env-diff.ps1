param(
    [string]$project = "uteklinker-chatbot-vercel"
)

# Läs in lokala .env
$localEnv = @{}
Get-Content ".env" | ForEach-Object {
    if ($_ -match "^\s*#") { return } # hoppa över kommentarer
    if ($_ -match "^\s*$") { return } # hoppa över tomma rader
    $parts = $_ -split "=", 2
    if ($parts.Length -eq 2) {
        $key = $parts[0].Trim()
        $val = $parts[1].Trim()
        $localEnv[$key] = $val
    }
}

# Hämta env från Vercel CLI
$vercelEnvRaw = vercel env ls --project $project --token $env:VERCEL_TOKEN
$vercelEnv = @{}

foreach ($line in $vercelEnvRaw) {
    if ($line -match "^\s*([A-Z0-9_]+)\s+Encrypted") {
        $key = $matches[1].Trim()
        $vercelEnv[$key] = "****" # vi jämför bara nycklar, inte värden
    }
}

Write-Host "`n=== 🔍 Diff mellan lokal .env och Vercel ($project) ===`n"

# 1. Finns lokalt men inte i Vercel
$onlyLocal = $localEnv.Keys | Where-Object { -not $vercelEnv.ContainsKey($_) }
if ($onlyLocal) {
    Write-Host "⚠️ Finns i .env men saknas i Vercel:" -ForegroundColor Yellow
    $onlyLocal | ForEach-Object { Write-Host "  $_" }
} else {
    Write-Host "✅ Alla lokala nycklar finns i Vercel."
}

# 2. Finns i Vercel men inte lokalt
$onlyVercel = $vercelEnv.Keys | Where-Object { -not $localEnv.ContainsKey($_) }
if ($onlyVercel) {
    Write-Host "`n⚠️ Finns i Vercel men inte i .env:" -ForegroundColor Yellow
    $onlyVercel | ForEach-Object { Write-Host "  $_" }
} else {
    Write-Host "`n✅ Alla Vercel-nycklar finns i .env."
}

# 3. Översikt
Write-Host "`n=== 📊 Översikt ==="
Write-Host "Totalt i .env:     $($localEnv.Count)"
Write-Host "Totalt i Vercel:  $($vercelEnv.Count)"
Write-Host "Gemensamma:       $(($localEnv.Keys | Where-Object { $vercelEnv.ContainsKey($_) }).Count)"
