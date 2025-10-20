# move-and-check.ps1
# 1. Flyttar utvalda filer från /api till /lib
# 2. Letar efter kvarvarande imports från /api/
#    Skriver både till konsol och loggfil.
# Ändrar inte innehållet i kodfiler.

$ErrorActionPreference = "Stop"

$root = "C:\uteklinker-chatbot-vercel"
$logFile = Join-Path $root "imports-check.txt"

# Rensa gammal logg om den finns
if (Test-Path $logFile) { Remove-Item $logFile }

# Filer som ska flyttas
$moveFiles = @(
    "utils.js",
    "faq-cache.js",
    "faq-data.js",
    "detect-lang.js",
    "allowed-words.json"
)

Write-Host "=== Steg 1: Flyttar filer ==="
foreach ($file in $moveFiles) {
    $src = Join-Path $root "api\$file"
    $dst = Join-Path $root "lib\$file"

    if (Test-Path $src) {
        Move-Item -Force $src $dst
        $msg = "Flyttade $file från /api till /lib"
        Write-Host $msg
        $msg | Out-File -FilePath $logFile -Append -Encoding utf8
    }
    else {
        $msg = "Saknas: $src"
        Write-Host $msg
        $msg | Out-File -FilePath $logFile -Append -Encoding utf8
    }
}

Write-Host "=== Steg 2: Kontrollerar imports ==="

# Vilka kodfiler vi vill scanna
$extensions = @("*.js","*.mjs","*.ts","*.tsx")

$files = Get-ChildItem -Path $root -Recurse -Include $extensions -File

foreach ($file in $files) {
    $lines = Get-Content -Path $file.FullName -Raw -Encoding UTF8 -ErrorAction SilentlyContinue |
             Select-String -Pattern "from\s+['""]\.?/api/"
    foreach ($match in $lines) {
        $msg = "$($file.FullName):$($match.LineNumber) $($match.Line.Trim())"
        Write-Host $msg
        $msg | Out-File -FilePath $logFile -Append -Encoding utf8
    }
}

Write-Host "=== Klar! Se loggfil: $logFile ==="
