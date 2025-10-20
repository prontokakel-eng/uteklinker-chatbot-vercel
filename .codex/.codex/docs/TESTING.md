# TESTING — Smoke & riktlinjer

## 1) npm scripts
- `test:filters` — kör WL/BL-sanity via `tests/filters-wl-bl.mjs`.
- `test:smoke` — kedjar tre röktester:
  1) `test:smoke:wlbl` — snabb WL/BL-check (PS-script)
  2) `test:smoke:formats` — normalisering (PS-script)
  3) `test:smoke:gate` — gate pipeline (PS-script)

## 2) PowerShell (exempelutdrag)
Röktester (körs av `test:smoke`):
- `tests/smoke-wlbl.ps1`
  - Asserter WL på `60 x 60 cm`, `100x100 cm`, BL på `viagra`, och ingen WL på neutralt ord.
- `tests/smoke-formats.ps1`
  - Kör enkel normaliseringskoll (ingen nätverksåtkomst).
- `tests/smoke-gate.ps1`
  - Kör `lib/gate.js` via Node `-e`, extraherar JSON-svaret, och kontrollerar att WL/BL-flödet funkar.

### Tips vid fel
- “Invalid package.json”: se till att **inte** klistra in skript med citatteckensfel.
- Om `ConvertFrom-Json` klagar: skriv `node -e`-strängen utan oönskad output (loggar kan störa JSON-parse).
- Vid “GCP_PRIVATE_KEY hade verkliga radbrytningar”: scriptet sanerar — OK att ignorera om test fortsätter.

## 3) Förväntade outputs (grönt)
- `[OK] WL should match 60 x 60 cm`
- `[OK] WL should match 100x100 cm`
- `[OK] BL should block 'viagra'`
- `[OK] WL should not trigger on neutral word`
- `[OK] formats normalization ran`
