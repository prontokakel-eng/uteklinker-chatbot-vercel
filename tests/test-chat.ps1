# test-chat.ps1
$baseUrl = "http://localhost:3000/api/chat"

$questions = @(
    @{ message = "Behöver betongen förbehandlas?"; lang = "SE"; mode = "STRICT" },
    @{ message = "Kan jag hämta själv?"; lang = "SE"; mode = "STRICT" },
    @{ message = "Do I need to pre-treat the concrete?"; lang = "EN"; mode = "STRICT" }
)

foreach ($q in $questions) {
    Write-Host ""
    Write-Host "Skickar fråga: $($q.message)" -ForegroundColor Cyan

    # Skapa JSON manuellt istället för ConvertTo-Json
    $body = "{ ""message"": ""$($q.message)"", ""lang"": ""$($q.lang)"", ""mode"": ""$($q.mode)"" }"

    try {
        $res = Invoke-RestMethod -Uri $baseUrl `
            -Method Post `
            -ContentType "application/json; charset=utf-8" `
            -Body $body

        Write-Host "Svar:" -ForegroundColor Green
        Write-Host "   reply : $($res.reply)"
        Write-Host "   source: $($res.source)"
    }
    catch {
        Write-Host "Fel vid anrop: $($_.Exception.Message)" -ForegroundColor Red
    }
}
