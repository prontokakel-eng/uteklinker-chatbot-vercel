# list-structure.ps1
Write-Host "=== Projektstruktur (relevanta filer) ==="

$paths = @(
  "api\*.js",
  "api\*.json",
  "lib\*.js",
  "lib\*.json",
  "tests\*.mjs",
  "tests\*.js"
)

foreach ($p in $paths) {
    Get-ChildItem -Path $p -ErrorAction SilentlyContinue | ForEach-Object {
        $relPath = $_.FullName.Replace((Get-Location).Path + "\", "")
        Write-Host $relPath
    }
}
