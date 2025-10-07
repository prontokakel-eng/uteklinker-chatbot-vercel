# backup.ps1 - spara och återställ detect/chat/utils/torture
param(
    [Parameter(Mandatory=$true)]
    [ValidateSet("save","restore")]
    [string]$action
)

$backupDir = "backups-" + (Get-Date -Format "yyyy-MM-dd")

$files = @(
  "lib/detect-lang.js",
  "api/chat.js",
  "lib/utils.js",
  "tests/torture-v3-new.mjs"
)

function Save-Files {
    if (-not (Test-Path $backupDir)) {
        New-Item -ItemType Directory -Path $backupDir | Out-Null
    }
    foreach ($f in $files) {
        if (Test-Path $f) {
            Copy-Item $f "$backupDir\" -Force
            Write-Host "✅ Saved $f → $backupDir\"
        } else {
            Write-Warning "⚠️ Missing: $f"
        }
    }
}

function Restore-Files {
    if (-not (Test-Path $backupDir)) {
        Write-Error "❌ No backup dir found: $backupDir"
        exit 1
    }
    foreach ($f in $files) {
        $src = Join-Path $backupDir (Split-Path $f -Leaf)
        if (Test-Path $src) {
            Copy-Item $src $f -Force
            Write-Host "✅ Restored $src → $f"
        } else {
            Write-Warning "⚠️ Missing in backup: $(Split-Path $f -Leaf)"
        }
    }
}

switch ($action) {
    "save" { Save-Files }
    "restore" { Restore-Files }
}
