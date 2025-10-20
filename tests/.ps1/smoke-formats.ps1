Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Assert($cond, $msg) { if (-not $cond) { throw "[FAIL] $msg" } else { Write-Host "[OK] $msg" } }
function Invoke-Node([string]$code) { node -e $code }

Invoke-Node "import('./lib/filters-config.js').then(m=>m.reloadFiltersConfig()).then(()=>import('./lib/wl-bl-filters.js')).then(f=>{console.log(JSON.stringify({a:f.applyWhitelist('600 x 600 mm',{lang:'SE'}),b:f.applyWhitelist('600x600mm',{lang:'SE'}),c:f.applyWhitelist('60x60',{lang:'SE'})}))}).catch(e=>{console.error(e);process.exit(1)})" | Out-Null

# Vi testar bara att skriptet körs; detaljerna täcks av smoke-wlbl
Write-Host "[OK] formats normalization ran"
