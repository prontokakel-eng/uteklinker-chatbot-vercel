# find-fs-logging.ps1
# Dry-run: listar alla ställen där fs.appendFileSync eller fs.writeFileSync används
# Ändrar inget, loggar till find-fs-logging-log.txt

$ErrorActionPreference = "Stop"

$root = (Resolve-Path "$PSScriptRoot\..")
$logFile = Join-Path $PSScriptRoot "find-fs-logging-log.txt"

if (Test-Path $logFile) { Remove-Item $logFile }

$extensions = @("*.js","*.mjs")

# Mappar vi vill skippa
$excludePatterns = @(
  "backup","golden","Test cache filer","logs","node_modules",
  "översättning","css",".vscode",".vercel",".py"
)

function Should-Exclude($path) {
    foreach ($ex in $excludePatterns) {
        if ($path.ToLower() -like "*$($ex.ToLower())*") { return $true }
    }
    return $false
}

$patterns = @("fs\.appendFileSync","fs\.writeFileSync")

$files = Get-ChildItem -Path $root -Recurse -Include $extensions -File |
         Where-Object { -not (Should-Exclude $_.FullName) }

foreach ($file in $files) {
    foreach ($pat in $patterns) {
        $matches = Select-String -Path $file.FullName -Pattern $pat
        foreach ($m in $matches) {
            $msg = "$($file.FullName):$($m.LineNumber) $($m.Line.Trim())"
            Write-Host $msg
            $msg | Out-File -FilePath $logFile -Append -Encoding utf8
        }
    }
}

Write-Host "=== Dry-run klar! Se loggfil: $logFile ==="
