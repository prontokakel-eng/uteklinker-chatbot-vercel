# find-env-usage.ps1
# Letar efter dotenv-importer och process.env-anrop
# Skriver resultat till find-env-usage-log.txt

$ErrorActionPreference = "Stop"

$root = (Resolve-Path "$PSScriptRoot\..")
$logFile = Join-Path $PSScriptRoot "find-env-usage-log.txt"

if (Test-Path $logFile) { Remove-Item $logFile }

$extensions = @("*.js","*.mjs","*.ts","*.tsx")

$patterns = @(
  "dotenv",
  "process.env"
)

$files = Get-ChildItem -Path $root -Recurse -Include $extensions -File |
         Where-Object {
           $_.FullName -notmatch "backup" -and
           $_.FullName -notmatch "golden" -and
           $_.FullName -notmatch "logs" -and
           $_.FullName -notmatch "node_modules" -and
           $_.FullName -notmatch "översättning" -and
           $_.FullName -notmatch "css" -and
           $_.FullName -notmatch "\.vscode" -and
           $_.FullName -notmatch "\.vercel" -and
           $_.FullName -notmatch "\.py"
         }

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

Write-Host "=== Klar! Se loggfil: $logFile ==="
