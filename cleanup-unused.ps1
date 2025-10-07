param(
    [string]$ProjectPath = "C:/uteklinker-chatbot-vercel",
    [switch]$Delete
)

$oldDir = Join-Path $ProjectPath "old-files-uteklinker-chatbot-vercel"
if (-Not (Test-Path $oldDir)) { New-Item -ItemType Directory -Path $oldDir | Out-Null }

# Skapa loggfil
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$logFile = Join-Path $oldDir "cleanup-$timestamp.log"
"Cleanup run $timestamp" | Out-File -FilePath $logFile -Encoding utf8

function Log-Action($msg) {
    $msg | Tee-Object -FilePath $logFile -Append
}

# Mappar och filer att BEHÅLLA
$keepDirs = @("lib", "config", "tests", "faq-extended", "public", "api")
$keepFiles = @(
    "package.json", "package-lock.json", ".gitignore",
    "vercel.json", ".env.local", ".env",
    "chatBot-torture-test-v3-NEW.mjs", "README.md"
)

# Flytta/radera mappar utanför whitelist
Get-ChildItem -Path $ProjectPath -Directory | ForEach-Object {
    if ($keepDirs -notcontains $_.Name -and $_.Name -ne "old-files-uteklinker-chatbot-vercel") {
        if ($Delete) { Remove-Item $_.FullName -Recurse -Force } else { Move-Item $_.FullName -Destination $oldDir -Force }
        Log-Action "Orphan folder handled: $($_.FullName)"
    }
}

# Flytta/radera filer utanför whitelist
Get-ChildItem -Path $ProjectPath -File | ForEach-Object {
    if ($keepFiles -notcontains $_.Name) {
        if ($Delete) { Remove-Item $_.FullName -Force } else { Move-Item $_.FullName -Destination $oldDir -Force }
        Log-Action "Orphan file handled: $($_.FullName)"
    }
}

# Junk patterns globalt
$junkPatterns = "*.log","*.tmp","*.bak","~$*.*"
Get-ChildItem -Path $ProjectPath -Recurse -File -Include $junkPatterns | ForEach-Object {
    if ($Delete) { Remove-Item $_.FullName -Force } else { Move-Item $_.FullName -Destination $oldDir -Force }
    Log-Action "Junk file handled: $($_.FullName)"
}

# Extra: rensa /faq-extended på cache/intermediära filer
$faqPath = Join-Path $ProjectPath "faq-extended"
$faqPatterns = ".cache_faq_translate_*.json","faq_keywords_cache.json","faq_ai_autocat.json","faq_ai_keywords.json"
Get-ChildItem -Path $faqPath -File -Include $faqPatterns | ForEach-Object {
    if ($Delete) { Remove-Item $_.FullName -Force } else { Move-Item $_.FullName -Destination $oldDir -Force }
    Log-Action "FAQ cache handled: $($_.FullName)"
}

Log-Action "Cleanup finished $timestamp"
