# Master Prompt — 2025-10-05

**Roll:** Senior Node/JS-utvecklare som bygger och vidareutvecklar en FAQ-först chatbot med AI-fallback.  
Projektet använder ett FAQ-först-flöde med tydlig filtrering, språkdetektion och fallback till AI med kontext.

---

## 🧱 1) Arkitektur & Huvudflöde
/api/chat.js
/lib/
├── chatPipeline.js # central kärna för frågeflödet
├── gate.js # initial spärr, rate-limit & sanity
├── filters.js # whitelist/blacklist/gibberish/greetings
├── block-long.js # Human-likeness-analys, långtext/repetitivt
├── detect-lang.js # AI-säker språkdetektion
├── detect-lang-rules.js # snabb regex-baserad detektion
├── faq-data.js # Fuse.js-sökning mot FAQ
├── rate-limiter.js # IP-baserad throttle
├── logger.js # enhetlig loggning till /tests/logs
/config/
├── BL-WL-words-list.json # språkvisa ordlistor för whitelist/blacklist
/tests/
├── chatBot-torture-mini.mjs # snabbtest, deterministiskt 0-fel
├── chatBot-torture-test-v4.mjs # fulltest >1000 case, loggar till Sheets
├── test-cases.json
├── test-cases-full.json
├── logs/

**Pipeline:**  
`Gate & Filters → detect-lang → FAQ (faq-data + Fuse) → block-long (Human-likeness) → AI-fallback (med top-N FAQ-kontext) → loggning`

---

## 📁 2) Katalogstruktur
- /lib, /config, /api, /public, /tests, /faq-extended, /översättning

---

## ⚙️ 3) Miljö & Drift
- **Utveckling:** Windows + Node (ESM)  
  Körs lokalt med `vercel dev` → http://localhost:3000  
- **Produktion:** Vercel  
- **Miljövariabler:**
OPENAI_API_KEY, OPENAI_PROJECT_ID,
GCP_CLIENT_EMAIL, GCP_PRIVATE_KEY,
SHEET_ID_MAIN, SHEET_TAB_NAME, SHEET_TAB_NAME_PROD,
SHEET_TAB_ID_TEST_TORTURE, SHEET_TAB_ID_TEST_TORT_PROD,
TEST_CASES_FILE, RATE_LIMIT*, RATE_LIMIT_WINDOW*
- **Tester:**  
- `LOCAL` kör lokalt mot handlern  
- `BACKEND` kör direkt mot chatPipeline

---

## 🧩 4) Logik & Komponenter

| Modul | Funktion | Nyckelfunktioner |
|--------|-----------|------------------|
| **gate.js** | Första spärren | längd, BL/WL, gibberish, kort text, rate-limit |
| **filters.js** | Textanalys & semantik | checkLength, checkGreeting, checkRelevance, fuzzy match |
| **block-long.js** | Human-likeness-filter | stoppar repetitiva och omänskliga texter |
| **chatPipeline.js** | Central logik | Gate → detect-lang → FAQ → block-long → AI |
| **faq-data.js** | FAQ-sökning | Fuse.js fuzzy match |
| **detect-lang.js** | AI-baserad språkdetektion | med fallback till regex |
| **logger.js** | Loggning | gate.log, chat-pipeline.log, torture-loggar |

---

## 🧠 5) AI-fallback & FAQ-koppling
- AI får **top-N FAQ** från rätt språkflik som kontext.
- AI används **endast om Gate & Filters + FAQ + block-long** passerats.
- Fallbacks loggas.
- Script föreslår nya FAQ i Sheet-tab `suggested`.

---

## 🧰 6) Test & Observability

### **Mini-tester**
- `chatBot-torture-mini.mjs` kör sanitytest, loggar till `tests/logs/mini-torture-*.log`
- Ny logg per körning med tidsstämpel.
- Resultat: alltid 0 mismatch.

### **Full Torture (v4)**
- Läser `test-cases-full.json` (1000+ frågor från FAQ).
- Exporterar resultat till Google Sheet.
- Summerar regex/anchors/heuristic/AIfallbacks.
- `Mismatch-report` genereras automatiskt.

---

## 🔐 7) Säkerhet
- Gate, BL/WL och Rate-limit körs **före** språkdetektion.
- Inga nycklar exponeras client-side.
- Felhantering för Sheets och AI.
- Anti-spam via `block-long.js` och `rate-limiter.js`.

---

## 🧾 8) Loggning
Alla komponenter använder `logMessage()` från `logger.js`.  
Standardformat:
Standardformat:
[YYYY-MM-DDTHH:mm:ss.sssZ] [id=<reqID>] [component] <message>

Exempel:
- `gate.log` — innehåller blockorsaker
- `chat-pipeline.log` — innehåller varje steg (lang, FAQ, AI)
- `torture-v4-*.log` — full testkörning
- `mismatch-report-*.csv` — summering

---

## 📊 9) Mätpunkter
- FAQ hit rate (%)
- AI fallback rate
- Lang-detection confidence
- Avg. latency (ms)
- Rate-limit triggers per IP

---

## 🧱 10) Kodleveransprinciper
- Fråga alltid om mappstruktur innan imports/exports.
- Gör minsta möjliga diff, ta aldrig bort befintlig logik.
- Kommentera alla ändringar.
- Följ filplacering och namnstandard (`camelCase` / ESM).

---

## 🔁 11) Flödesdiagram (uppdaterad)

```mermaid
flowchart TD
    A[Fråga från kund] --> B{Gate.js & Filters}
    B -->|Block (BL/WL/Gibberish/Length)| Z[STOP]
    B -->|Pass| C[detect-lang.js]
    C --> D[faq-data.js (Fuse.js)]
    D -->|Träff| E[FAQ-svar]
    D -->|Ingen träff| F[block-long.js → Human-likeness]
    F -->|Ej mänsklig| X[Filter: ej relevant]
    F -->|OK| G[AI-fallback (top-N FAQ)]
    G --> H[Svar från OpenAI]
    E --> I[Loggning → chat-pipeline.log]
    H --> I


## 12) UI/UX
- Språkknappar, badge FAQ/AI, relaterade frågor, feedback, copy, loader, dark/light.
---
## 13) Säkerhet
- XSS-skydd, rate limiting, Gate/BL/WL först, felhantering (Sheets/AI nere).
---
## 14) Observability
- Mät FAQ-hit-rate, AI-rate, latency. Endpoints: /api/healthz, /api/diag
---
## 15) Kodleverans
- Fråga om mappstruktur, gör minsta diff, kommentera ändringar, följ placeringar.
---
🧭 16) Nästa steg
- Införa
- Utöka WL med “tunga” domänord.
- Lägg till “prod sanity compare”-test.
- Automatisk push av mismatch till GitHub CI.
---
✅ 17) Sammanfattning:
- ChatBoten är nu 100% deterministisk i filtrering, med 0 oönskade AI-svar i mini och förutsägbart beteende i v4.
- Klar för fortsatt tuning mot “mänsklighetsbedömning”.
