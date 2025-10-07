# 🧩 CHANGELOG — ChatBot Torture Framework 2025-10-05

## 🗓️ Datum
2025-10-05

## 🚀 Översikt
Största stabilitets- och filtreringsuppdateringen hittills. Fokus på deterministiskt beteende under `torture-mini` och `torture-v4`-tester.  
Målet: 0 mismatch, 0 oönskade AI-fall för långa eller blockerade texter.

---

## 🧠 Nya moduler
### `/lib/block-long.js`
- Ny, fristående logik för att analysera långa och repetitiva texter innan AI aktiveras.
- Mäter:
  - total längd  
  - ordmängd  
  - unikhetskvot  
  - repetitivitet (loopade ord)
- Kräver minst **3 WL-träffar**, varav **minst 1 tung** (längre ord > 5 tecken) för att passera.
- Ger `via="filtered-long"` och svarar direkt utan AI-anrop.
- Körs *före* AI-delen i `chatPipeline.js`.

---

## 🔐 Förbättringar i filter/gate
### `/lib/filters.js`
- Fullständig omskrivning med robustare WL/BL-hantering.
- Införda debug-loggar:
  - listlängd, regex-test och träffstatistik.
- Fuzzy-match stabiliserad.
- Hälsningsdetektion (`checkGreeting`) förbättrad.
- Längdkontroll (`checkLength`) används tidigt.
- Relevansfilter (`checkRelevance`) fångar korta och nonsens-frågor.

### `/lib/gate.js`
- Gate fungerar nu deterministiskt med tydliga loggar:
  - `rawLen`, `rawMsg`, samt typ av block (long, blacklist, short, gibberish).
- Normalisering sker efter BL-kontroll, vilket förhindrar förlust av whitespace.
- Rate-limit bibehållen men instrumenterad.
- Loggning till `gate.log` + `gate.debug.log`.

---

## 🔗 `/lib/chatPipeline.js`
- Ny **LONG-guard** integrerad:
  - anropar `assessLongRepetitive()` från `block-long.js` innan FAQ/AI.
  - stoppar texter som inte är mänskliga i karaktär.
- Fix: korrekt import av `searchFaq` (tidigare `getAnswerFromFAQ`).
- Lagt till tydliga loggar för:
  - `AI fallback trigger`
  - `LONG-blocked`
  - `FAQ hits`
  - `Lang detect`

---

## 🧪 Torture Framework
### `/tests/chatBot-torture-mini.mjs`
- Kortversion för sanity-tester.
- Skapar ny loggfil per körning med tidsstämpel.
- Kör LOCAL pipeline (ej backend) för snabbhet.
- ✅ Stabilt resultat: **0 mismatch**, 0 oönskade AI-fallbacks.

### `/tests/chatBot-torture-test-v4.mjs`
- Full körning mot `test-cases-full.json` (~1000 testfall).
- Dynamisk loggfil med tidsstämplar.
- Stats-tabell: regex / anchors / heuristic / ai.
- Exporterar resultat till Google Sheet.
- ⚠️ `repeatCell`-bugg fixad (felaktiga `endIndex`-fält).
- Resultat: 284 mismatch (vid första körning med 1000+ cases).

---

## 📊 Loggstruktur
- Alla tester loggar nu till `/tests/logs/`:
- torture-v4-2025-10-05T14-14-22-397Z.log
- mini-torture-2025-10-05T08-26-18-139Z.log
- gate.log
- chat-pipeline.log

---

## 📂 Nya miljövariabler
- TEST_CASES_FILE=test-cases-full.json
- SHEET_TAB_NAME=TEST_TORTURE
- SHEET_TAB_NAME_PROD=TEST_TORT_PROD
- SHEET_TAB_ID_TEST_TORTURE=957984581
- SHEET_TAB_ID_TEST_TORT_PROD=1995713261

---

## 🧰 Förbättrad felsökning
- Instrumenterade loggar i `containsBlacklistWord()` för att visa - list-storlek och regex-tester.
- `runGate()` loggar varje filtreringsorsak.
- `torture-v4` genererar mismatch-report `.csv` i `tests/logs/`.

---

## 🧩 Sammanfattning
| Modul | Status | Nytt/ändrat |
|--------|---------|-------------|
| filters.js | ✅ stabil | fuzzy + BL/WL-debug |
| gate.js | ✅ stabil | extra loggning |
| chatPipeline.js | ✅ stabil | LONG-guard |
| block-long.js | 🆕 | ny modul |
| torture-mini | ✅ | deterministisk 0-fel |
| torture-v4 | ⚙️ | stor testmängd, 284 mismatch första run |
| .env | ✅ | TEST_CASES_FILE + Sheet-flikar |

---

## ✅ Slutresultat
- **AI fallback** eliminerad för alla “LONG” och “BLOCK” scenarier.
- **Deterministiskt** testutfall mellan körningar.
- Klar för steg 2: *Human-likeness scoring* (planerat 2025-10-06).
