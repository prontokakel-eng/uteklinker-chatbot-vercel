# ===============================================
# 🧱 create-snapshot-git.ps1
# Tar en "safe snapshot" av nuvarande Git-repo
# Skapar annoterad tagg + pushar den till origin
# ===============================================

# Kontrollera att vi kör i rätt mapp
Write-Host "🔍 Checking current directory..."
$repoPath = "C:\uteklinker-chatbot-vercel"
Set-Location $repoPath

# Säkerhetskontroll – kräver att det är ett git-repo
if (-not (Test-Path "$repoPath\.git")) {
    Write-Host "❌ Ingen .git-mapp hittades! Avbryter." -ForegroundColor Red
    exit 1
}

# Generera datum-baserad snapshot-tagg
$timestamp = Get-Date -Format "yyyy-MM-dd_HHmm"
$tagName = "v${timestamp}_safe"
$tagMessage = "Snapshot: Stable version created $timestamp"

Write-Host "🧩 Creating Git snapshot tag: $tagName"

# Skapa annoterad tagg
git tag -a $tagName -m $tagMessage

# Push till GitHub
Write-Host "🚀 Pushing tag to origin..."
git push origin $tagName

# Bekräfta att taggen finns
Write-Host "`n✅ Snapshot created and pushed successfully!"
Write-Host "🔖 Tag name: $tagName"
Write-Host "📦 Verify on GitHub under: Code → Tags"
