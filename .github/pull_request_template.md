## Beskrivning
- [ ] Minimal diff, ingen borttagen befintlig logik

## Checklista
- [ ] Lint/Typecheck passerar
- [ ] Knip: inga oanvända exports/filer (eller dokumenterade undantag)
- [ ] Madge: 0 cirkulära beroenden
- [ ] Tester: gröna
- [ ] Coverage ≥ tröskel (just nu 70%)

## Testnoteringar
- [ ] E2E smoke körd lokalt / i CI
- [ ] Manuell sanity (valfritt): /api/health
## 📦 Sammanfattning
_Beskriv kort vad PR:en gör och varför._

## ✅ Checklista
- [ ] Kod kör `npm run audit` lokalt utan errors
- [ ] Språktester `npm run test:lang` är gröna
- [ ] Inga nya oavsiktliga orphans (kolla `npm run deadcode`)
- [ ] CI är grön
- [ ] Logikförändringar är dokumenterade i `CHANGELOG.md`

## 🔎 Test & verifiering
_Steg/loggar, ev. screenshots. Klistra in relevanta utdrag från `logs/*.log` om det påverkar Gate/Filters._

## 🧹 Städrutiner
- [ ] Nya hjälpskript placerade i `scripts/**` (ej i `lib/**`)
- [ ] Arkiverad kod hamnar i `_deprecated/**` eller `archive/**`
- [ ] Uppdaterade/nya whitelistade “keepers” motiverade i `scripts/audit-runner.js`

## 📣 Övrigt
_Risker, breaking changes, påverkan på Vercel, env etc._
