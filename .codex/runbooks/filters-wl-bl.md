# Runbook — WL/BL Filters

## Syfte
Gate ska vara deterministisk och “fail-safe”. WL => släpp igenom (handled), BL => blockera (handled), annars fortsätt kedjan.

## Var ligger filerna?
- `config/BL-WL-words-list.json` – huvudordlista (ALL + språknycklar).
- `lib/filters-config.js` – laddar/normaliserar ordlistor (exponerar `getWhitelistForLang`, `getBlacklistForLang`).
- `lib/wl-bl-filters.js` – applicerar WL/BL i `gate`.

## Order of operations (i `lib/gate.js`)
1. WL (tidig exit: **filtered:false**, via `whitelist`)
2. BL (tidig exit: **filtered:true**, via `blacklist`)
3. Gibberish → ev. block
4. ShortWord Lang → ev. early route
5. Greeting → ev. early route
6. LangDetect Core (skipAI=true)
7. RateLimit

## Test
```bash
npm run test:filters
