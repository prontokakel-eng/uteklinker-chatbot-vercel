# patch-fs-logging.ps1
# Gör .bak backup och ersätter fs.appendFileSync(...) med logMessage(...)
# Behåller befintliga variabler (LOG_FILE, logFile)
# Lägger till import av logMessage om det saknas

$ErrorActionPreference = "Stop"

$root    = (Resolve-Path "$PSScriptRoot\..")
$logFile = Join-Path $PSScriptRoot "patch-fs-logging-log.txt"

if (Test-Path $logFile) { Remove-Item $logFile }

$extensions  = @("*.js","*.mjs")
$utf8        = New-Object System.Text.UTF8Encoding($false)
$includeDirs = @("api","lib")

$files = foreach ($dir in $includeDirs) {
    $folder = Join-Path $root $dir
    if (Test-Path $folder) {
        Get-ChildItem -Path $folder -Recurse -Include $extensions -File
    }
}

foreach ($file in $files) {
    $lines    = Get-Content -Path $file.FullName -Encoding UTF8
    $changed  = $false

    # Ersätt fs.appendFileSync(...) med logMessage(...)
    for ($i=0; $i -lt $lines.Count; $i++) {
        if ($lines[$i] -match "fs\.appendFileSync") {
            $lines[$i] = $lines[$i] -replace "fs\.appendFileSync\s*\(", "logMessage("
            $changed = $true
        }
    }

    # Lägg till import av logMessage om det saknas
    if ($changed -and ($lines -notmatch "logMessage")) {
        $relPath = if ($file.DirectoryName -like "*\api*") { "../lib/logger.js" } else { "./logger.js" }
        $importLine = "import { logMessage } from `"$relPath`";"
        $lines = @($importLine, "") + $lines
    }

    if ($changed) {
        Copy-Item -Path $file.FullName -Destination ($file.FullName + ".bak") -Force
        [System.IO.File]::WriteAllLines($file.FullName, $lines, $utf8)

        $msg = "Patchade: $($file.FullName)"
        Write-Host $msg
        $msg | Out-File -FilePath $logFile -Append -Encoding utf8
    }
}

Write-Host "=== Klar! Se loggfil: $logFile ==="
