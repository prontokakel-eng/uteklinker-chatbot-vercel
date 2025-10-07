# README – Kod-prompts (Windows-version)  
🗓️ Senast uppdaterad: 2025-10-05

---

## 📦 Struktur
- `system-prompt-WIN.md` → Regler och utvecklarroll  
- `master-prompt-WIN.md` → Backend- och pipeline-arkitektur  
- `oversattning-prompt-WIN.md` → Språk- och översättningsflöden  
- `ui-ux-prompt-WIN.md` → Frontend och interaktion (användargränssnitt)

---

## ⚙️ Användning

1. **System Prompt**  
   Klistra in först i ny session. Definierar utvecklarrollen, kodstil, och beteende.  
2. **Master Prompt**  
   Använd i sessions som behandlar **chatbotlogik**, test, och backendflöde.  
3. **Översättningsprompt**  
   Körs separat för att skapa eller verifiera FAQ-översättningar (SE → EN/DA/DE).  
4. **UI/UX Prompt**  
   Använd i frontend-sessioner för att bygga eller justera användargränssnittet.

---

## 💡 Tips
- Versionera alltid filerna (`v1`, `v2`, …).  
- Placera alla prompts i `/kod` i projektet.  
- Testa nya logikändringar via `chatBot-torture-mini.mjs` innan merge.  
- Kör fulltest (`chatBot-torture-test-v4.mjs`) vid produktionskandidater.  

---

## 🧱 Arkitektur — Kortfattat
Chatboten följer ett **FAQ-först-flöde** med filtrering, språkdetektion och fallback till AI endast vid behov.  
All filtrering sker före språkdetektion och AI för att säkerställa deterministiska resultat.

---

## 🧩 Huvudkomponenter

| Modul | Funktion | Beskrivning |
|--------|-----------|-------------|
| `gate.js` | Första spärr | Längd, blacklist, whitelist, gibberish, rate-limit. |
| `filters.js` | Textfiltrering | Hanterar relevans, hälsningar, fuzzy-match och korta texter. |
| `block-long.js` | Human-likeness | Stoppar långa, repetitiva eller icke-mänskliga frågor. |
| `chatPipeline.js` | Huvudflöde | Gate → detect-lang → FAQ → block-long → AI. |
| `faq-data.js` | FAQ-hantering | Fuse.js-baserad fuzzy matchning mot rätt språkflik. |
| `detect-lang.js` | Språkdetektion | AI-baserad, fallback till `detect-lang-rules.js`. |
| `logger.js` | Loggning | Skriver till `/tests/logs/*.log` och Sheets. |
| `tests/chatBot-torture-mini.mjs` | Snabbtest | Deterministisk körning (0 mismatch). |
| `tests/chatBot-torture-test-v4.mjs` | Fulltest | 1000+ frågor, export till Google Sheets. |

---

## 🧠 Tester & Loggar

### Loggmapp
`/tests/logs/`  
Varje körning skapar en ny loggfil med tidsstämpel.  
Exempel:[YYYY-MM-DDTHH:mm:ss.sssZ] [id=<reqID>] [component] <message>


### Sheets-export
- Lokal test: flik `TEST_TORTURE`
- Prod test: flik `TEST_TORT_PROD`
- Mismatchar exporteras till `torture-mismatch-report-*.csv`

---

## 🔐 Säkerhet
- Alla Gate & Filter-steg körs före språkdetektion.  
- `block-long.js` fångar spam, automatiskt genererade och repetitiva texter.  
- Rate-limit skyddar mot flood och bottar.  
- Ingen miljövariabel får exponeras i klientkod.  

---

## 🧭 Flödesdiagram (uppdaterat 2025-10-05)

```mermaid
flowchart TD
    A[Fråga från kund] --> B{Gate.js & Filters.js}
    B -->|Block (WL/BL/Gibberish/Length)| Z[STOP]
    B -->|Pass| C[detect-lang.js]
    C --> D[faq-data.js (Fuse.js)]
    D -->|Träff| E[FAQ-svar]
    D -->|Ingen träff| F[block-long.js → Human-likeness]
    F -->|Ej mänsklig| X[Filter: ej relevant]
    F -->|OK| G[AI-fallback (med top-N FAQ-kontext)]
    G --> H[Svar från OpenAI]
    E --> I[Loggning → chat-pipeline.log]
    H --> I

✅ Sammanfattning

Systemet är nu stabilt, deterministiskt och självsanerande.
Alla tester (mini/v4) körs konsekvent med 0 oönskade AI-svar för långa eller blockerade frågor.
Den nya modulen block-long.js ger robust Human-likeness-analys före AI.
Alla komponenter följer Node ESM-standard och Vercel-anpassad driftmiljö.