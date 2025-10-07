# patch-fs-logging-dryrun.ps1
# Dry-run: listar vilka filer och rader som skulle ersättas med logMessage()
# Ändrar inget, loggar till patch-fs-logging-dryrun-log.txt

$ErrorActionPreference = "Stop"

$root = (Resolve-Path "$PSScriptRoot\..")
$logFile = Join-Path $PSScriptRoot "patch-fs-logging-dryrun-log.txt"

if (Test-Path $logFile) { Remove-Item $logFile }

$extensions = @("*.js","*.mjs")
$utf8 = New-Object System.Text.UTF8Encoding($false)

# Endast prod-kodmappar
$includeDirs = @("api","lib")

$files = foreach ($dir in $includeDirs) {
    $folder = Join-Path $root $dir
    if (Test-Path $folder) {
        Get-ChildItem -Path $folder -Recurse -Include $extensions -File
    }
}

$patterns = @("fs\.appendFileSync","fs\.writeFileSync")

foreach ($file in $files) {
    foreach ($pat in $patterns) {
        $matches = Select-String -Path $file.FullName -Pattern $pat
        foreach ($m in $matches) {
            $msg = "Skulle ersätta i $($file.FullName):$($m.LineNumber) $($m.Line.Trim())"
            Write-Host $msg
            $msg | Out-File -FilePath $logFile -Append -Encoding utf8
        }
    }
}

Write-Host "=== Dry-run klar! Se loggfil: $logFile ==="
