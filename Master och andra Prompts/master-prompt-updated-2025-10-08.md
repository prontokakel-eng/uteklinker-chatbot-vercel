# Master Prompt (Updated 2025-10-08)

## Översikt & huvudflöde
FAQ‑first chatbot med deterministiskt flöde och AI‑fallback endast när regler/heuristik inte räcker.
**Huvudflöde:** Gate & Filters → Detect‑Lang (regex → heuristik → SE‑fallback → grupp/tying) → FAQ (Fuse.js) → ev. block‑long → AI‑fallback (med top‑N FAQ‑kontext) → loggning.

## Icke‑förhandlingsbart (projektregler)
- **Fråga alltid** om **mapp-/filstruktur** innan imports/exports föreslås – gissa aldrig paths.
- Vid ändringar i uppladdad kod: **ta aldrig bort logik**, gör **minsta möjliga diff** och **markera ändringen** i kod med kommentarer.
- **Stack/Drift:** Vanilla JS + HTML/CSS, Node (Windows dev), Vercel (`vercel dev` lokalt :3000, Vercel prod).
- **Miljövariabler:** Google = `GCP-*`, OpenAI = `OPENAI_API_KEY`. **Aldrig** exponera hemligheter i klientkod.
- **Språk:** SE/EN/DA/DE. Auto-detektera men låt UI kunna åsidosätta.
- **Gate & Filters körs före allt** (före språk, FAQ, AI). BL/WL/keywords lever i `/config`.
- När AI används: injicera **top‑N närliggande FAQ** som kontext (även under tröskel) för att minska hallucinationer.

## Modulöversikt & struktur (aktuellt)
```
/lib
  gate.js
  filters.js
  block-long.js
  detect-lang-core.js          # v6.3: hierarkisk kedja (regex → heuristik → SE fallback → grupp → IP → AI)
  detect-lang-rules.js         # v6.2: språkbevarande normalisering + viktjusteringar
  detect-lang-heuristics.js    # token-/diakrit-heuristik
  faq-fuzzy-detect.js          # ev. snabb språkledtråd från FAQ-index
  faq-data.js                  # laddar/servar FAQ-data (Fuse.js-index)
  faq-cache.js                 # cache (inkl. ev. DA/DE_FULL_LOOKUP framåt)
  faq-sheets.js                # Google Sheets I/O (queue + flush), GCP‑servicekonto
  openai-client.js             # central OpenAI‑klient
  logger.js                    # enhetlig loggning
  utils-progress.js            # CLI‑progressbar till tester
/tests
  faq-lang-benchmark-v4.mjs    # aktuell benchmark (CSV + Sheets)
  logs/                        # resultat & fails (csv per datum)
/config
  gates.json / keywords.json / allowlists.json / blocklists.json (exempel)
```
**Avlägsnat från master (legacy):** `detect-lang.js` (AI‑centrerad), `chatBot-torture-*` (ersätts av `faq-lang-benchmark-v4.mjs`).

## Språkdetektion – design (v6.3)
Kedja i `detect-lang-core.js`:
1) **Regex (rulesOnly)**: exklusiva markörer och lexikonpoäng. Returnerar direkt vid `confidence ≥ 0.8`.
2) **Heuristik (group)**: diakrit‑ och tokenbaserade signaler. Returnerar om `confidence ≥ 0.8`.
3) **SE‑fallback (v6.3)**: om låg confidence och frågan innehåller typiska svenska frågeord (**vilka|vilken|vad|hur|varför|finns|kan|är|har**) och **inte** tydliga DA/DE‑markörer → `SE` med hög confidence.
4) **Gruppanalys (fallback)**: ytterligare heuristik (om fortfarande lågt).
5) **IP tiebreak** (om tillgängligt).
6) **AI fallback**: strikt klass (SE/DA/DE/EN), låg `max_tokens`, `temperature: 0`.

### Normalisering & diakriter (rules v6.2)
- **Bevara nordiska/tyska diakriter:** `å ä ö` (SE), `æ ø` (DA), `ü ö ß` (DE).
- Ta bort *andra* accentmarkörer (é, á, …) som stör lexikonmatchning.
- Justerade vikter: SE‑ankare +0.45, DE‑ankare +0.55, övriga 0.4.
- Starka exklusiva markörer per språk (t.ex. `varför`, `hvordan`, `welche`, `ß`, `ü`).
- Startordsbooster för SE (t.ex. `vilka|vilken|finns|har|är|…`).
- Blandtext‑korrigering (SE→EN om tydliga engelska tokens i svenskt sammanhang).

## FAQ‑sökning & kontext
- `faq-data.js` bygger Fuse‑index per språk och används både i FAQ‑svar och för snabba språkledtrådar (`faq-fuzzy-detect.js`).
- Vid AI‑fallback injiceras **top‑N närliggande FAQ** i prompten för att minska hallucinationer.

## Tester & mätning
**Benchmark:** `tests/faq-lang-benchmark-v4.mjs`  
- Miljöflaggor: `TEST_MODE=true` (stänger AI‑fallback), `CLEAR_GOOGLE_TAB_BEFORE_RUN=true`, `SHEET_TAB_NAME`, `SHEET_ID_MAIN`.
- Skriver **resultat** och **fails** till `tests/logs/faq-lang-benchmark-YYYY-MM-DD.csv` samt `tests/logs/faq-lang-fails-YYYY-MM-DD.csv`.
- Pushar löpande resultat till Google Sheets (queue + flush).
**Nyckeltal:**
- Lang‑accuracy per språk
- FAQ hit‑rate
- AI fallback‑rate
- Latens (ms)
- Rate‑limit triggers

## Senaste kända resultat (2025‑10‑08)
- **SE:** 98.32 % (234/238)
- **EN:** 96.22 % (229/238)
- **DA:** 87.82 % (209/238)
- **DE:** 81.51 % (194/238)
*(SE boost från v6.3; DA/DE förbättrade efter språkbevarande normalisering i v6.2).*
Källor: benchmarkskriptet och loggar i `/tests/logs/` (CSV + Sheets).

## Miljö & drift
- **Node ESM** överallt (inga CJS‑imports).
- **Vercel** för drift; lokalt `vercel dev` på port 3000.
- **GCP servicekonto** för Sheets via `faq-sheets.js`. Hantera nätverksfel och rate‑limits.
- **Sekretess:** inga nycklar i klientbundles.
- **Logger:** skriv alltid till respektive `{component}.log` och till konsolen i dev.

## Import/Export‑principer (stabilt API)
- Ändra **inte** exportnamn som används brett (t.ex. `detectLangRulesOnly`, `detectLangCore`).
- Lägg till nya lager modulärt utan att bryta call‑sites (fallbacks är additive).
- Följ ESM‑stil: **named exports** där möjligt.

## Roadmap – nästa iteration (v6.4)
**Lexikal tiebreaker innan AI:**  
- Utnyttja `faq-cache.js` för **`DA_FULL_LOOKUP`** och **`DE_FULL_LOOKUP`**: om texten (rensad från siffror/tecken) innehåller något token/n‑gram från respektive språklista → sätt språk till DA/DE med `via: "faq-lexical"` och `confidence ≈ 0.85`.
- Placering: i `detect-lang-core.js` **efter** heuristik/SE‑fallback men **före** IP/AI.
- Syfte: höj DA/DE‑precision, sänk AI‑anrop.
- Observabilitet: logga träffar som `🇩🇰 DA_FULL_LOOKUP` / `🇩🇪 DE_FULL_LOOKUP`.

## Checklista vid ändringar
- [ ] Behåll befintliga imports/exports orörda (eller gör aliasing om nödvändigt).
- [ ] Markera koddiffar med `// 🧩 vX.Y`.
- [ ] Kör `faq-lang-benchmark-v4.mjs` med `TEST_MODE=true` först (snabbt), sedan utan (full pipeline).
- [ ] Verifiera att `tests/logs/faq-lang-fails-*.csv` minskar över tid per språk.
- [ ] Uppdatera denna Master Prompt vid större pipeline‑ändringar.
