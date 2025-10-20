function Remove-Ansi([string]$s) {
  if (-not $s) { return $s }
  # strip ANSI escapes
  return ([regex]::Replace($s, "`e\[[0-9;]*[A-Za-z]", ""))
}

function Invoke-NodeJsonArgs([string]$code, [string[]]$args) {
  $prevErrPref = $ErrorActionPreference
  try {
    $ErrorActionPreference = 'Continue'   # don't turn stderr into a terminating error
    $out = & node -e $code @args 2>&1     # merge stderr->stdout
  } finally {
    $ErrorActionPreference = $prevErrPref
  }

  if (-not $out) { throw "Node returned no output." }

  $clean = (Remove-Ansi ($out | Out-String))

  # pick the last JSON object in the (possibly noisy) output
  $m = [regex]::Matches($clean, '{[\s\S]*}', 'Singleline')
  if ($m.Count -gt 0) {
    return ($m[$m.Count-1].Value | ConvertFrom-Json)
  }

  throw "Node output did not contain JSON.`n$clean"
}
