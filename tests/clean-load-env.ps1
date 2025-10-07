# clean-load-env.ps1
# Rensar bort skräpsekvenser efter patchen i filer som använder import "../lib/load-env.js";

$ErrorActionPreference = "Stop"

$root = (Resolve-Path "$PSScriptRoot\..")
$logFile = Join-Path $PSScriptRoot "clean-load-env-log.txt"

if (Test-Path $logFile) { Remove-Item $logFile }

$extensions = @("*.js","*.mjs")
$utf8 = New-Object System.Text.UTF8Encoding($false)

$files = Get-ChildItem -Path $root -Recurse -Include $extensions -File |
         Where-Object {
             (Get-Content $_.FullName -Raw -Encoding UTF8) -match 'import\s+"\.\./lib/load-env\.js";'
         }

foreach ($file in $files) {
    $lines = Get-Content -Path $file.FullName -Encoding UTF8

    # Ta bort tomma rader eller skräp direkt efter importen
    $cleaned = @()
    $firstDone = $false

    foreach ($line in $lines) {
        if (-not $firstDone -and $line -match 'import\s+"\.\./lib/load-env\.js";') {
            $cleaned += 'import "../lib/load-env.js";'
            $firstDone = $true
            continue
        }

        # hoppa över rader som bara är `r`n; eller ; eller whitespace
        if ($firstDone -and ($line -match '^[`\r`\n;\s]+$')) {
            continue
        }

        $cleaned += $line
    }

    $originalText = ($lines -join "`r`n")
    $newText = ($cleaned -join "`r`n")

    if ($newText -ne $originalText) {
        # backup
        Copy-Item -Path $file.FullName -Destination ($file.FullName + ".bak2") -Force
        [System.IO.File]::WriteAllText($file.FullName, $newText, $utf8)

        $msg = "Rensade skräp i: $($file.FullName)"
        Write-Host $msg
        $msg | Out-File -FilePath $logFile -Append -Encoding utf8
    }
}

Write-Host "=== Klar! Se loggfil: $logFile ==="
