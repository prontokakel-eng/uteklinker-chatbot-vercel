# cleanup-bak.ps1
# Tar bort alla .bak, .bak2, .bak3, .bak4 i projektet
# Skapar loggfil cleanup-bak-log.txt

$ErrorActionPreference = "Stop"

$root = (Resolve-Path "$PSScriptRoot\..")
$logFile = Join-Path $PSScriptRoot "cleanup-bak-log.txt"

if (Test-Path $logFile) { Remove-Item $logFile }

# Vilka filändelser vi vill ta bort
$patterns = "*.bak","*.bak2","*.bak3","*.bak4"

$files = Get-ChildItem -Path $root -Recurse -Include $patterns -File

foreach ($file in $files) {
    $msg = "Raderar: $($file.FullName)"
    Write-Host $msg
    $msg | Out-File -FilePath $logFile -Append -Encoding utf8

    Remove-Item -Path $file.FullName -Force
}

Write-Host "=== Klar! Se loggfil: $logFile ==="
