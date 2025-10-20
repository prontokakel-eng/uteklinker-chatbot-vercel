$Url = "http://localhost:3000/api/faq-data?lang=SE"

Write-Host "⏱️ Testar cache på $Url"

function Measure-Request {
    param($url)
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    $result = Invoke-WebRequest -Uri $url -Method GET
    $sw.Stop()
    return @{ TimeMs = $sw.ElapsedMilliseconds; Length = $result.Content.Length }
}

# Kör flera requests
$results = @()
for ($i=1; $i -le 5; $i++) {
    $res = Measure-Request -url $Url
    Write-Host "🔹 Request $i: $($res.TimeMs) ms, content length: $($res.Length)"
    Start-Sleep -Seconds 1
    $results += $res
}

# Summering
$avg = ($results | Measure-Object -Property TimeMs -Average).Average
Write-Host "✅ Snittid: $avg ms"
