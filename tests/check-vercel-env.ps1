param(
    [string]$EnvFile = ".\.env.vercel"
)

if (-Not (Test-Path $EnvFile)) {
    Write-Host "ERROR: Filen $EnvFile hittades inte. Kör 'vercel env pull' först."
    exit 1
}

Write-Host "Reading environment variables from $EnvFile"
$envFile = Get-Content $EnvFile

# Plocka ut rader
$clientEmail = ($envFile | Where-Object { $_ -match "^GCP_CLIENT_EMAIL" }) -replace "GCP_CLIENT_EMAIL=",""
$privateKey  = ($envFile | Where-Object { $_ -match "^GCP_PRIVATE_KEY" }) -replace "GCP_PRIVATE_KEY=",""

# Resultat
if ($clientEmail) {
    Write-Host "OK: GCP_CLIENT_EMAIL hittades:"
    Write-Host "   $clientEmail"
} else {
    Write-Host "MISSING: GCP_CLIENT_EMAIL saknas!"
}

if ($privateKey) {
    Write-Host "OK: GCP_PRIVATE_KEY hittades."
    Write-Host ("   Början: " + $privateKey.Substring(0,[Math]::Min(30,$privateKey.Length)) + "...")
    Write-Host "   Längd : $($privateKey.Length) tecken"

    if ($privateKey -match "BEGIN PRIVATE KEY" -and $privateKey -match "END PRIVATE KEY") {
        Write-Host "   OK: innehåller BEGIN/END block"
    } else {
        Write-Host "   WARNING: BEGIN/END saknas – kontrollera formatet"
    }

    if ($privateKey -match "\\n") {
        Write-Host "   OK: innehåller \\n (radbrytningsmarkörer)"
    } else {
        Write-Host "   WARNING: inga \\n hittades – kan ge problem i Vercel"
    }
} else {
    Write-Host "MISSING: GCP_PRIVATE_KEY saknas!"
}
