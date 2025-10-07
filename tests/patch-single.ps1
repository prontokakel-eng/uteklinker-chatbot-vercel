# patch-single.ps1
# Testar import-patch på EN fil (utils.js) innan vi kör hela projektet

$ErrorActionPreference = "Stop"

$root = "C:\uteklinker-chatbot-vercel"
$file = Join-Path $root "lib\utils.js"   # ändra sökvägen om filen ligger annanstans
$logFile = Join-Path $root "imports-patch-single-log.txt"

# Rensa gammal logg
if (Test-Path $logFile) { Remove-Item $logFile }

# UTF-8 encoder utan BOM
$utf8 = New-Object System.Text.UTF8Encoding($false)

if (Test-Path $file) {
    # Läs in rå bytes och tolka som UTF-8
    $bytes = [System.IO.File]::ReadAllBytes($file)
    $text  = $utf8.GetString($bytes)

    # Ersätt imports
    $newText = $text -replace "(?<=from\s+['""])\.?/api/", "./lib/"

    if ($newText -ne $text) {
        [System.IO.File]::WriteAllText($file, $newText, $utf8)
        $msg = "Uppdaterade imports i: $file"
        Write-Host $msg
        $msg | Out-File -FilePath $logFile -Append -Encoding utf8
    } else {
        Write-Host "Inga imports att ändra i: $file"
    }
} else {
    Write-Host "Filen hittades inte: $file"
}

Write-Host "=== Klar! Se loggfil: $logFile ==="
