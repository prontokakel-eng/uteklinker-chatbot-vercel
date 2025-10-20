# fix-load-env.ps1
# 1. Skapar .bak av alla filer som ändras
# 2. Ersätter dotenv-importer med central import ../lib/load-env.js
# 3. Loggar resultat

$ErrorActionPreference = "Stop"

$root = (Resolve-Path "$PSScriptRoot\..")
$logFile = Join-Path $PSScriptRoot "fix-load-env-log.txt"

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

    # Ta bort tidigare dotenv-importer
    if ($text -match 'import\s+dotenv\s+from\s+"dotenv"') {
        $text = $text -replace 'import\s+dotenv\s+from\s+"dotenv"\s*;?', ''
        $changed = $true
    }

    # Ta bort dotenv.config({ path: ".env.vercel" });
    if ($text -match 'dotenv\.config\(\{\s*path:\s*".env.vercel"\s*\}\)\s*;?') {
        $text = $text -replace 'dotenv\.config\(\{\s*path:\s*".env.vercel"\s*\}\)\s*;?', ''
        $changed = $true
    }

    # Om vi gjort ändringar, lägg in importen högst upp
    if ($changed) {
        $lines = $text -split "`r?`n"
        # Lägg till raden överst
        $lines = @("import `"../lib/load-env.js`";") + $lines
        $text = ($lines -join "`r`n")

        # Skapa backup
        Copy-Item -Path $file.FullName -Destination ($file.FullName + ".bak") -Force

        # Skriv ändrad fil
        [System.IO.File]::WriteAllText($file.FullName, $text, $utf8)

        $msg = "Uppdaterade till load-env i: $($file.FullName)"
        Write-Host $msg
        $msg | Out-File -FilePath $logFile -Append -Encoding utf8
    }
}

Write-Host "=== Klar! Se loggfil: $logFile ==="
