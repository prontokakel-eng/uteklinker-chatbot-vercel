# fix-load-env-clean.ps1
# Rensar bort skräp efter import "../lib/load-env.js"; och skapar .bak3 backup

$ErrorActionPreference = "Stop"

$root = (Resolve-Path "$PSScriptRoot\..")
$logFile = Join-Path $PSScriptRoot "fix-load-env-clean-log.txt"

if (Test-Path $logFile) { Remove-Item $logFile }

$extensions = @("*.js","*.mjs")
$utf8 = New-Object System.Text.UTF8Encoding($false)

$files = Get-ChildItem -Path $root -Recurse -Include $extensions -File |
         Where-Object { (Get-Content $_.FullName -Raw -Encoding UTF8) -match 'import\s+"\.\./lib/load-env\.js";' }

foreach ($file in $files) {
    $lines = Get-Content -Path $file.FullName -Encoding UTF8
    $cleaned = @()
    $firstDone = $false

    foreach ($line in $lines) {
        if (-not $firstDone -and $line -match 'import\s+"\.\./lib/load-env\.js";') {
            $cleaned += 'import "../lib/load-env.js";'
            $firstDone = $true
            continue
        }

        # hoppa över ensamma n;, ; eller whitespace
        if ($line -match '^\s*n;\s*$' -or $line -match '^\s*;\s*$' -or $line -match '^\s*$') {
            continue
        }

        $cleaned += $line
    }

    $originalText = ($lines -join "`r`n")
    $newText = ($cleaned -join "`r`n")

    if ($newText -ne $originalText) {
        # backup
        Copy-Item -Path $file.FullName -Destination ($file.FullName + ".bak3") -Force
        [System.IO.File]::WriteAllText($file.FullName, $newText, $utf8)

        $msg = "Fixade skräp i: $($file.FullName)"
        Write-Host $msg
        $msg | Out-File -FilePath $logFile -Append -Encoding utf8
    }
}

Write-Host "=== Rensning klar! Se loggfil: $logFile ==="
