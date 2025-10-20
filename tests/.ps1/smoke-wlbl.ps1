Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

function Assert($cond, $msg) {
  if (-not $cond) { throw "[FAIL] $msg" } else { Write-Host "[OK] $msg" }
}

function Invoke-NodeJson([string]$code) {
  $out = node -e $code
  $m = [regex]::Matches($out, '\{.*\}', 'Singleline')
  if ($m.Count -gt 0) { return ($m[$m.Count-1].Value | ConvertFrom-Json) }
  throw "Node output did not contain JSON.`n$out"
}

$wl60 = Invoke-NodeJson "import('./lib/wl-bl-filters.js').then(f=>{console.log(JSON.stringify(f.applyWhitelist('Har ni 60 x 60 cm uteplattor?',{lang:'SE'})))}).catch(e=>{console.error(e);process.exit(1)})"
Assert ($wl60.handled -eq $true) "WL should match 60 x 60 cm"

$wl100 = Invoke-NodeJson "import('./lib/wl-bl-filters.js').then(f=>{console.log(JSON.stringify(f.applyWhitelist('Finns 100x100 cm?',{lang:'SE'})))}).catch(e=>{console.error(e);process.exit(1)})"
Assert ($wl100.handled -eq $true) "WL should match 100x100 cm"

$bl = Invoke-NodeJson "import('./lib/wl-bl-filters.js').then(f=>{console.log(JSON.stringify(f.applyBlacklist('detta är viagra',{lang:'SE'})))}).catch(e=>{console.error(e);process.exit(1)})"
Assert ($bl.handled -eq $true) "BL should block 'viagra'"

$neutral = Invoke-NodeJson "import('./lib/wl-bl-filters.js').then(f=>{console.log(JSON.stringify(f.applyWhitelist('uteplattor',{lang:'SE'})))}).catch(e=>{console.error(e);process.exit(1)})"
Assert ($neutral.handled -eq $false) "WL should not trigger on neutral word"
