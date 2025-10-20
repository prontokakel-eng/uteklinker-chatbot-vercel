$questions = @(
  # Svenska
  "Behöver betongen förbehandlas?",
  "Kan jag hämta själv?",
  "ute klinker på altan?",
  "utomhusplattor till trädgården?",
  "2 cm klinkerplattor för uteplats?",

  # Engelska
  "Do I need to pre-treat the concrete?",
  "Can I pick it up myself?",
  "outdoor tile for garden?",
  "thick porcelain tiles for terrace?",
  "porcelain paving in my backyard?",

  # Danska
  "Behøver betonen forbehandles?",
  "Kan jeg hente selv?",
  "2cm fliser til terrasse?",
  "havefliser udendørs?",
  "tykke fliser til altan?",

  # Tyska
  "Muss der Beton vorbehandelt werden?",
  "Kann ich es selbst abholen?",
  "Gartenfliesen für die Terrasse?",
  "2 cm Fliesen für draußen?",
  "dicke Fliesen für Balkon?"
)

foreach ($q in $questions) {
    Write-Host "`nSkickar fråga: $q" -ForegroundColor Cyan

    $body = @{
        message = $q
        lang    = "SE"   # 🔹 kan ändras, men boten normaliserar ändå via synonyms.js
        mode    = "STRICT"
    } | ConvertTo-Json -Compress -Depth 3

    try {
        $response = Invoke-RestMethod -Uri "http://localhost:3000/api/chat" `
                                      -Method Post `
                                      -ContentType "application/json" `
                                      -Body $body
        Write-Host "Svar:" -ForegroundColor Green
        $response | Format-List
    }
    catch {
        Write-Host "💥 Fel vid anrop: $($_.Exception.Message)" -ForegroundColor Red
    }
}
