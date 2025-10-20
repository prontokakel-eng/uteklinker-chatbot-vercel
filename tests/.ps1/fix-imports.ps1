# fix-imports.ps1
# Flyttar .js/.json från /api till /lib och uppdaterar imports
# Bevarar UTF-8, rör INTE encoding.
# Skriver även en logglista med alla ändringar.

$ErrorActionPreference = "Stop"

$root = "C:\uteklinker-chatbot-vercel"
$logFile = Join-Path $root "moved-imports.txt"

# Rensa gammal logg
if (Test-Path $logFile) { Remove-Item $logFile }

# Vilka filer som ska flyttas
$moveFiles = @(
    "utils.js",
    "faq-cache.js",
    "faq-data.js",
    "detect-lang.js",
    "allowed-words.json"
)

foreach ($file in $moveFiles) {
    $src = Join-Path $root "api\$file"
    $dst = Join-Path $root "lib\$file"

    if (Test-Path $src) {
        Move-Item -Force $src $dst
        "Flyttade $file från /api → /lib" | Out-File -FilePath $logFile -Append -Encoding utf8
        Write-Host "📦 Flyttade $file från /api → /lib"
    }
    else {
        "Saknas: $src" | Out-File -FilePath $logFile -Append -Encoding utf8
        Write-Host "⚠️ Kunde inte hitta $src"
    }
}

# Uppdatera imports i alla kodfiler
$extensions = @("*.js","*.mjs","*.ts","*.tsx")
$files = Get-ChildItem -Path $root -Recurse -Include $extensions -File

$utf8 = New-Object System.Text.UTF8Encoding($false)

foreach ($file in $files) {
    try {
        # Läs rå bytes
        $bytes = [System.IO.File]::ReadAllBytes($file.FullName)
        $text  = $utf8.GetString($bytes)

        # Ersätt imports
        $newText = $text -replace "(?<=from\s+['""])\.?/api/", "./lib/"

        if ($newText -ne $text) {
            [System.IO.File]::WriteAllText($file.FullName, $newText, $utf8)
            "Imports fixade i: $($file.FullName)" | Out-File -FilePath $logFile -Append -Encoding utf8
            Write-Host "✏️ Uppdaterade imports i $($file.FullName)"
        }
    }
    catch {
        Write-Host "❌ Fel i $($file.FullName): $_"
    }
}

Write-Host "✅ Klart! Alla filer flyttade och imports uppdaterade."
Write-Host "📑 Se loggfil: $logFile"
