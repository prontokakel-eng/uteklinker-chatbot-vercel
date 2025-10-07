$envFile = ".\.env.vercel"
Write-Host "Reading environment variables from $envFile"

$vars = Get-Content $envFile | ForEach-Object {
    if ($_ -match "^(.*?)=(.*)$") {
        @{ Name = $matches[1]; Value = $matches[2] }
    }
}

function Check-Var($name, $minLength=1) {
    $item = $vars | Where-Object { $_.Name -eq $name }
    if (-not $item) {
        Write-Host "$name saknas!"
    } elseif ($item.Value.Length -lt $minLength) {
        Write-Host "$name finns men är misstänkt kort (${($item.Value.Length)} chars)"
    } else {
        # Visa de första och sista 30 tecknen så vi kan se BEGIN/END PRIVATE KEY
        $previewStart = $item.Value.Substring(0, [Math]::Min(30, $item.Value.Length))
        $previewEnd   = $item.Value.Substring([Math]::Max(0, $item.Value.Length-30))
        Write-Host "$name OK (length=${($item.Value.Length)})"
        Write-Host "   Start: $previewStart ..."
        Write-Host "   End:   ... $previewEnd"
    }
}

Check-Var "OPENAI_API_KEY" 40
Check-Var "GCP_PROJECT_ID" 5
Check-Var "GCP_PRIVATE_KEY_ID" 5
Check-Var "GCP_PRIVATE_KEY" 500
Check-Var "GCP_CLIENT_EMAIL" 10
Check-Var "GCP_CLIENT_ID" 5
Check-Var "SHEET_ID" 10
Check-Var "USE_FUZZY"
