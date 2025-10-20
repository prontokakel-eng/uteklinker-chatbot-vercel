# fix-relative-imports.ps1
# 1. Skapar .bak av alla filer som ändras (rollback möjligt)
# 2. Uppdaterar imports från /api → /lib
# 3. Kontrollerar kvarvarande /api-imports
# UTF-8 bevaras (utan BOM)

$ErrorActionPreference = "Stop"

$root = (Resolve-Path "$PSScriptRoot\..")  # projektroten
$logFile = Join-Path $PSScriptRoot "fix-relative-imports-log.txt"
$checkFile = Join-Path $PSScriptRoot "fix-relative-imports-check.txt"

if (Test-Path $logFile) { Remove-Item $logFile }
if (Test-Path $checkFile) { Remove-Item $checkFile }

$libFiles = @(
    "utils.js","faq-cache.js","faq-data.js","detect-lang.js","allowed-words.json"
)

$extensions = @("*.js","*.mjs","*.ts","*.tsx")
$utf8 = New-Object System.Text.UTF8Encoding($false)

# Mappar att exkludera
$excludePatterns = @(
  "backup","golden","logs","node_modules",
  "översättning","css",".vscode",".vercel",".py"
)

function Should-Exclude($path) {
    foreach ($ex in $excludePatterns) {
        if ($path.ToLower() -like "*$($ex.ToLower())*") { return $true }
    }
    return $false
}

function Get-RelativePath($fileDir, $target) {
    $uri1 = New-Object System.Uri ($fileDir + "\")
    $uri2 = New-Object System.Uri (Join-Path "$root\lib" $target)
    return $uri1.MakeRelativeUri($uri2).ToString().Replace("\","/")
}

# Endast aktiva mappar
$includeDirs = @("api","lib","tests","old tests","Test cache filer")

$files = foreach ($dir in $includeDirs) {
    $folder = Join-Path $root $dir
    if (Test-Path $folder) {
        Get-ChildItem -Path $folder -Recurse -Include $extensions -File |
            Where-Object { -not (Should-Exclude $_.FullName) }
    }
}

foreach ($file in $files) {
    $bytes = [System.IO.File]::ReadAllBytes($file.FullName)
    $text  = $utf8.GetString($bytes)
    $original = $text

    foreach ($libFile in $libFiles) {
        $pattern1 = "(?<=from\s+['""])\.\/$libFile"
        $pattern2 = "(?<=from\s+['""])\.\.?\/api\/$libFile"
        $relPath  = "./" + (Get-RelativePath $file.DirectoryName $libFile)

        $text = $text -replace $pattern1, $relPath
        $text = $text -replace $pattern2, $relPath
    }

    if ($text -ne $original) {
        # Skapa backup .bak
        Copy-Item -Path $file.FullName -Destination ($file.FullName + ".bak") -Force

        # Skriv ändrad fil
        [System.IO.File]::WriteAllText($file.FullName, $text, $utf8)

        $msg = "Uppdaterade imports i: $($file.FullName)"
        Write-Host $msg
        $msg | Out-File -FilePath $logFile -Append -Encoding utf8
    }
}

Write-Host "=== Patch klar! Se loggfil: $logFile ==="

# Kontrollsteg – leta kvarvarande /api-imports
Write-Host "=== Kontroll efter patch ==="

$leftovers = Get-ChildItem -Path $root -Recurse -Include $extensions -File |
             Where-Object { -not (Should-Exclude $_.FullName) } |
             ForEach-Object {
                 $content = Get-Content -Path $_.FullName -Raw -Encoding UTF8
                 if ($content -match "from\s+['""]\.?/api/") {
                     $msg = "Kvarvarande import i: $($_.FullName)"
                     Write-Host $msg
                     $msg | Out-File -FilePath $checkFile -Append -Encoding utf8
                 }
             }

Write-Host "=== Kontroll klar! Se $checkFile för ev. kvarvarande imports ==="
