# OPERATIONS — Miljöer & drift

## 1) Miljöfiler
- **Lokal dev (3000)**: `.env.local`
- **Tester**: `tests/.env`
- **Prod (Vercel)**: `.env.vercel`
> Samma nycklar (API, Sheets), men olika flaggor (`TESTMODE=true/false` etc).

## 2) Vercel
- `vercel dev` lokalt på 3000.
- Prod: `vercel --prod` (tidigare `vercel prod --force` användes ibland).
- Pull av env: `npm run pull-env` (anropar `vercel-pull.js`).

## 3) Loggar
- `filters.log`, `gate.log`, `faq-data.log`, `faq-cache.log`, `detect-lang.log`.
- Titta efter:
  - `WL loaded: <n> | BL loaded: <n> | NEU loaded: <n>`
  - `✅ Whitelist match: ...`
  - `🚫 Blacklist match: ...`
  - `Gate pass: <LANG> (…msg…)`

## 4) Caching
- FAQ/Lookups hämtas från Google Sheets och cachas i `faq-cache`.
- Varmstart sker automatiskt vid första anrop (se loggar).

## 5) IP & språk
- `lib/ip-lang.js`: ger hint (SE/EN/DA/DE/UNKNOWN). **Hinten är icke-blockerande**, d.v.s. används i språkdetekt men stoppar inte legitima VPN-användare.
