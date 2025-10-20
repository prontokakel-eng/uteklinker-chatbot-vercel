# fix-dotenv.ps1
# 1. Skapar .bak av alla filer som ändras
# 2. Ersätter import "dotenv/config" och dotenv.config() med .env.vercel-laddning
# 3. Loggar resultat

$ErrorActionPreference = "Stop"

$root = (Resolve-Path "$PSScriptRoot\..")
$logFile = Join-Path $PSScriptRoot "fix-dotenv-log.txt"

if (Test-Path $logFile) { Remove-Item $logFile }

$extensions = @("*.js","*.mjs","*.ts","*.tsx")
$utf8 = New-Object System.Text.UTF8Encoding($false)

# Mappar att exkludera
$excludePatterns = @(
  "backup","golden","logs","node_modules",
  "översättning","css",".vscode",".vercel",".py"
)

function Should-Exclude($path) {
    foreach ($ex in $excludePatterns) {
        if ($path.ToLower() -like "*$($ex.ToLower())*") { return $true }
    }
    return $false
}

$files = Get-ChildItem -Path $root -Recurse -Include $extensions -File |
         Where-Object { -not (Should-Exclude $_.FullName) }

foreach ($file in $files) {
    $bytes = [System.IO.File]::ReadAllBytes($file.FullName)
    $text  = $utf8.GetString($bytes)
    $original = $text

    $changed = $false

    # Ersätt import "dotenv/config"
    if ($text -match 'import\s+"dotenv/config"') {
        $text = $text -replace 'import\s+"dotenv/config"', 'import dotenv from "dotenv";`r`ndotenv.config({ path: ".env.vercel" });'
        $changed = $true
    }

    # Ersätt dotenv.config() utan path
    if ($text -match 'dotenv\.config\(\)') {
        $text = $text -replace 'dotenv\.config\(\)', 'dotenv.config({ path: ".env.vercel" })'
        $changed = $true
    }

    if ($changed -and $text -ne $original) {
        # Backup
        Copy-Item -Path $file.FullName -Destination ($file.FullName + ".bak") -Force

        # Skriv ändrad fil
        [System.IO.File]::WriteAllText($file.FullName, $text, $utf8)

        $msg = "Uppdaterade dotenv i: $($file.FullName)"
        Write-Host $msg
        $msg | Out-File -FilePath $logFile -Append -Encoding utf8
    }
}

Write-Host "=== Klar! Se loggfil: $logFile ==="
