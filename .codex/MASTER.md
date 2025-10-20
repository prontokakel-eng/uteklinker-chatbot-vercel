# MASTER — Single Source of Truth

Senast uppdaterad: 2025-10-09

## 1) Syfte
Detta dokument är repo-övergripande “SSOT” för mål, arkitektur och beslut. Det länkar vidare till detaljerade dokument.

## 2) Arkitektur (översikt)
- **API-lager**: `api/chat.js`, `api/chat-debug.js`, `api/healthz.js`, `api/save-ai-reply.js`, `api/save-faq-reply.js`
- **Kärnbibliotek**: `lib/gate.js`, `lib/wl-bl-filters.js`, `lib/filters-config.js`, `lib/detect-lang-core.js`, `lib/ip-lang.js`, `lib/rate-limiter.js`, `lib/gibberish-filter.js`
- **FAQ & källor**: Google Sheets (FAQ_SE/EN/DA/DE + *_FULL_LOOKUP)
- **Konfiguration**: `config/BL-WL-words-list.json`, `config/sizes.json`, `config/formats.json`, `config/neutral-words.json`
- **Tester**: `tests/filters-wl-bl.mjs`, `tests/smoke-*.ps1` m.fl.

## 3) Viktiga beslut (2025-10-09)
Se även [/docs/FILTERS.md](./FILTERS.md) för detaljer.

### 3.1 Whitelist / Blacklist (WL/BL)
- **Laddas via** `lib/filters-config.js` från `config/BL-WL-words-list.json` (+ merge av `sizes.json` in i WL.ALL).
- **Säker ALL-hantering** i `lib/wl-bl-filters.js`:
  - **Alfabetiska ALL-ord** (utan siffror) **triggar endast om** de även finns i språkets WL (SE/EN/DA/DE).
  - **Format/nummer-termer** (t.ex. `60x60`, `600x600mm`) är globalt tillåtna (ALL) och matchas tolerant.
  - **Blacklist**: ALL gäller alltid (språklista + ALL slås ihop).
- **Normalisering** i matcher:
  - `×/✕ → x`, mellanslag “squeezas”, `cm` och “no-space” varianter hanteras (t.ex. `60 x 60 cm` ≈ `60x60cm`).
  - Ordgränser för rena alfabetiska tokens (för färre falska positiva).

### 3.2 Formats & Sizes
- `config/sizes.json`: normalisering till kanoniska format (t.ex. `600x600mm` → `60x60cm`).
- `config/formats.json`: whitelistade format/varianter, används som domänord i WL (via `filters-config`).
- Resultat: “Finns 100x100 cm?” → WL-träff (`100x100cm`), “60 x 60” → WL-träff (`60x60cm`).

### 3.3 Gate-pipeline
Ordning i `lib/gate.js`:
1. **WL (med kandidat-språk)** → släpper igenom domänord snabbt.
2. **BL (med kandidat-språk)** → tidig block.
3. **Gibberish**.
4. **Kortordsdetektion** (per språk).
5. **Hälsning** (default SE).
6. **Språkdetekt** (`detectLangCore`) med **IP-hint** (icke-blockerande).
7. **Rate limit**.
> Kandidat-språk väljs via kortord → IP → ALL.

### 3.4 Neutral-ord
- `config/neutral-words.json` laddas (SE/EN/DA/DE/ALL). Används för tester och framtida heuristik, **inte** direkt i `gate` än.

## 4) Testning
- **Röktester**: PowerShell-script i `/tests` — se [/docs/TESTING.md](./TESTING.md).
- **npm scripts**: `test:smoke`, `test:filters` m.fl.

## 5) Miljöer
- **Lokal (3000)**: `.env.local`
- **Tester**: `tests/.env` (samma keys, men testflaggor)
- **Prod (Vercel)**: `.env.vercel`
Detaljer i [/docs/OPERATIONS.md](./OPERATIONS.md).

## 6) Kvarvarande arbete (Codex)
Se [/docs/CODEX-PROGRESS-PLAN.md](./CODEX-PROGRESS-PLAN.md) för daglig status. Kort:
- [ ] Finjustera språkdetektor (mål 90–95% på SE/EN/DA/DE).
- [ ] Rensa repo (duplicerade filer/”kopia”-filer).
- [ ] Konsolidera tester och CI-körning.
- [ ] Dokumentera fallback-logik (AI-svar cache → FAQ).
- [ ] Slutlig hårdning av BL (spam/fraud) + ev. IP-baserade reduceringar utan att blockera legitima VPN-användare.
