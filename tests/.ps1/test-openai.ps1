# =============================
# Testa OpenAI API från PowerShell
# =============================

# 1. Se till att dina env-variabler är satta innan du kör:
#    $env:OPENAI_API_KEY="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"
#    $env:OPENAI_PROJECT_ID="proj_nP7gK99Vvv2vVb318oB2AP5D"

Write-Host "API Key length:" $env:OPENAI_API_KEY.Length
Write-Host "Project ID:" $env:OPENAI_PROJECT_ID

# Bygg headers
$headers = @{
  "Authorization" = "Bearer $env:OPENAI_API_KEY"
  "OpenAI-Project" = $env:OPENAI_PROJECT_ID
  "Content-Type"   = "application/json"
}

# 2. Lista modeller
Write-Host ""
Write-Host "=== Listing models ==="
$responseModels = Invoke-WebRequest `
  -Uri "https://api.openai.com/v1/models" `
  -Headers $headers `
  -Method Get

$responseModels.Content | ConvertFrom-Json | Select-Object -ExpandProperty data | Select-Object id

# 3. Testa en prompt
Write-Host ""
Write-Host "=== Testing chat completion ==="
$body = @{
  model = "gpt-4o-mini"
  messages = @(
    @{ role = "user"; content = "Säg hej från PowerShell!" }
  )
  max_tokens = 50
} | ConvertTo-Json -Depth 3

$responseChat = Invoke-WebRequest `
  -Uri "https://api.openai.com/v1/chat/completions" `
  -Headers $headers `
  -Method Post `
  -Body $body

$responseChat.Content | ConvertFrom-Json | Select-Object -ExpandProperty choices | Select-Object -ExpandProperty message
