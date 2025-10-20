# check-env-sync.ps1
$reportText = "env-check-report.txt"
$reportJson = "env-check-report.json"

Write-Host "Kontrollerar Environment Variables i Vercel-projektet i denna mapp`n"
"Rapport för projektet" | Out-File $reportText

# --- 1. Hämta variabler från Vercel ---
$envsText = vercel env ls
$vercelEnv = ($envsText | Select-String -Pattern "^[A-Z0-9_]+").Matches.Value | Sort-Object -Unique

# --- 2. Hämta variabler från lokal .env ---
$localEnv = @()
if (Test-Path ".\.env") {
    $localEnv = Get-Content ".\.env" | ForEach-Object {
        if ($_ -match "^\s*([A-Z0-9_]+)=") { $matches[1] }
    }
}

# --- 3. Hitta variabler i koden + fil/linjer ---
$files = Get-ChildItem -Path . -Include *.js,*.ts,*.json -Recurse
$matchDetails = @()
$usedEnv = @()

foreach ($m in ($files | Select-String -Pattern "process.env.([A-Z0-9_]+)")) {
    if ($m.Line -match "process.env.([A-Z0-9_]+)") {
        $varName = $matches[1]
        $usedEnv += $varName
        $matchDetails += [PSCustomObject]@{
            Variable = $varName
            File     = $m.Path
            Line     = $m.LineNumber
            Code     = $m.Line.Trim()
        }
    }
}
$usedEnv = $usedEnv | Sort-Object -Unique

# --- 4. Jämförelser ---
$missingInVercel = $usedEnv | Where-Object {$_ -notin $vercelEnv}
$unusedInCode    = $vercelEnv | Where-Object {$_ -notin $usedEnv}
$missingLocal    = $localEnv | Where-Object {$_ -notin $vercelEnv}
$unusedBoth      = $vercelEnv | Where-Object {($_ -in $localEnv) -and ($_ -notin $usedEnv)}

# --- 5. Skriv ut text ---
function Write-Section($title, $items) {
    Write-Host "`n=== $title ==="
    "`n=== $title ===" | Out-File $reportText -Append
    if ($items -and $items.Count -gt 0) {
        $items | ForEach-Object {
            Write-Host $_
            $_ | Out-File $reportText -Append
        }
    } else {
        Write-Host "Inga"
        "Inga" | Out-File $reportText -Append
    }
}

Write-Section "Använda i koden men saknas i Vercel" $missingInVercel
Write-Section "Finns i Vercel men används ej i koden" $unusedInCode
Write-Section "Finns i .env men inte i Vercel" $missingLocal
Write-Section "Finns i både Vercel & .env men används inte i koden" $unusedBoth

$summary = @(
    "`n=== Översikt ===",
    "Totalt i Vercel: $($vercelEnv.Count)",
    "Totalt i .env: $($localEnv.Count)",
    "Totalt använda i kod: $($usedEnv.Count)"
)
$summary | ForEach-Object { Write-Host $_; $_ | Out-File $reportText -Append }

# --- 6. Exportera JSON ---
$reportData = [PSCustomObject]@{
    vercelEnv       = $vercelEnv
    localEnv        = $localEnv
    usedEnv         = $usedEnv
    matches         = $matchDetails
    missingInVercel = $missingInVercel
    unusedInCode    = $unusedInCode
    missingLocal    = $missingLocal
    unusedBoth      = $unusedBoth
}
$reportData | ConvertTo-Json -Depth 4 | Out-File $reportJson -Encoding UTF8

Write-Host "`n📄 Rapporter sparade:"
Write-Host " - Text: $reportText"
Write-Host " - JSON: $reportJson"
