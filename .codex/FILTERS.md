# FILTERS — WL/BL/NEU + formats/sizes

## 1) Datakällor
- `config/BL-WL-words-list.json` — huvudkälla för WL/BL per språk + ALL.
- `config/sizes.json` — normaliseringslista; mergas in i WL.ALL (format/nummer-termer).
- `config/formats.json` — explicita format/varianter (extra domänord).
- `config/neutral-words.json` — neutrala ord för test/heuristik.

## 2) Laddning & cache (lib/filters-config.js)
- Säker JSON-läsning, dedupe, trimming.
- NEUTRAL stöder tre former: `{NEUTRAL:{…}}`, `{SE/EN/…}`, eller en platt array (→ ALL).
- Publika getters:
  - `getWhitelistForLang(lang)`
  - `getBlacklistForLang(lang)`
  - `getNeutralForLang(lang)`
  - `reloadFiltersConfig()`

## 3) Matchningsregler (lib/wl-bl-filters.js)
- **normalizeForCompare**: lower, `×/✕→x`, trim spaces, normalisera `cm`.
- **includesSmart**:
  - Alfabetiska tokens: ordgränsregex (`\btoken\b`).
  - Numeriska/format: tolerant substring + nospace-variant.
- **Säker ALL** (WL):
  - Alfabetiska ALL-termer kräver att samma term finns i språkspecifik WL.
  - Numeriska/format i ALL är alltid giltiga.
- **BL**: språklista + ALL slås ihop (ALL gäller alltid).

## 4) Exempel
- “Har ni **60 x 60 cm** uteplattor?” → WL match (`60x60cm`).
- “Finns **100x100 cm**?” → WL match (`100x100cm`).
- “Detta är **viagra**?” → BL match (`viagra`).

## 5) Kända fallgropar
- Lägg inte in korta funktionsord (“att”, “detta”) i **ALL** för att undvika falska positiva.
- Om en **alfabetisk** ALL-term måste vara globalt giltig: lägg den även i varje språk-sektion eller hantera särskilt i kod.
