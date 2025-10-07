# CHANGELOG – 2025-10-04

## 🚀 Arkitektur / Core
- **AI fallback flyttad sist i pipeline**  
  - Säkerställer att FAQ, greetings, relevansfilter och black/whitelist alltid körs innan AI.  
  - Minskar risken att AI svarar på blockerad input.

- **Enhetlig cache-struktur**  
  - `faq-cache.js` nu split:  
    - `getFaqCache()` → FAQ-data (Q/A).  
    - `getLookupCache()` → Lookup-data (keywords).  
  - Ger SSOT (Single Source of Truth) för både FAQ och keyword lookups.

## 📂 Data / Sheets
- `faq-sheets.js` ansvarar **enbart för Google Sheets IO**.  
- `faq-cache.js` bygger och sparar kombinerad cache.  
- Övriga moduler läser endast via cache.

## 🛡️ Gate & Filters
- `gate.js` flyttade rate-limit-check sist.  
- `filters.js`: hälsningsfraser + relevansfilter infört (exporterat `greetings` + `checkRelevance`).  
- Rate limiter (`rate-limiter.js`):  
  - Test mode → full bypass med logg.  
  - Whitelist bypass loggas.  
  - Förbättrade loggmeddelanden.

## 🤖 FAQ / Keywords
- `faq-data.js`: fixade normalization (`FAQ` vs `faq`).  
- `faq-keywords.js`: använder `getLookupCache()` i stället för Sheets.  
- Fuse-index byggs på FAQ-data, loggar träffar.

## 🧪 Tester
- **Mini torture**:  
  - Skriver loggar till `/tests/logs/`.  
  - Utökat med GREETING och RELEVANCE-case.  
- **Torture v4**:  
  - Samma logik som mini, men på stora dataset.  
  - Enhetlig loggning.

## 📖 Dokumentation
- **system-prompt, master-prompt, README** uppdaterade:  
  - Nya regler för cache, imports/exports.  
  - Flowchart i mermaid (kund → gate → detect-lang → filters → FAQ → AI → reply).  
  - README förklarar prompts och användning.  
- Versionerade filer med dagens datum (`-2025-10-04.md`).  
