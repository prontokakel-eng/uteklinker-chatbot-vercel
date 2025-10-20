# sync-env.ps1
# Läser in .env och laddar upp varje variabel till Vercel (production)

$envFile = ".env"
if (-Not (Test-Path $envFile)) {
    Write-Host "❌ Filen $envFile finns inte här." -ForegroundColor Red
    exit 1
}

# Läs varje rad i .env
Get-Content $envFile | ForEach-Object {
    if ($_ -match "^\s*#") { return }  # hoppa över kommentarer
    if ($_ -match "^\s*$") { return }  # hoppa över tomma rader

    $parts = $_ -split "=", 2
    $key = $parts[0].Trim()
    $value = $parts[1].Trim()

    if ($key -and $value) {
        Write-Host "➕ Lägger till $key i Vercel..." -ForegroundColor Cyan
        # Kör vercel CLI interaktivt, skickar in värdet
        echo $value | vercel env add $key production --force
    }
}
