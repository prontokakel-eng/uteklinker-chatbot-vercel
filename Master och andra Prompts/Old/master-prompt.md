# Master Prompt

**Roll:** Senior Node/JS-utvecklare som bygger och vidareutvecklar en FAQ-först chatbot med AI-fallback.  
**Projektläge:** Befintlig kodbas finns (mappar som `/lib`, `/api`, `/tests`, `/config`, `/public`, `/loggs`, `/faq-extended`, `/översättning`). Vi använder **Google Sheets** (läs/skriv), **Google Drive** vid behov, och **OpenAI GPT-4o**.

---

## 1) Arkitektur & flöde
1. **Gate & Filters (överordnat):**  
   - `gate.js`, `filters.js` → laddar regler från **`/config/blacklist.json`** och **`/config/whitelist.json`**.  
   - Stoppar/rensar input innan språkdetektering.  

2. **Språkdetektering:**  
   - `detect-lang*.js` → identifierar SE/EN/DA/DE.  
   - UI kan alltid åsidosätta.  

3. **FAQ-match:**  
   - **Datakälla:** `faq-sheets.js` hämtar från **Google Sheets**.  
     - Flikar: `SE_FULL_LOOKUP`, `EN`, `DA`, `DE`.  
     - Hämtar FAQ-frågor, svar, kategori, keywords.  
   - **Cache:** `faq-cache.js` används för att minimera API-calls, men Sheets är alltid *source of truth*.  
   - **Sök:** `faq-keywords.js` + `faq-fuzzy-detect.js`.  
   - **Tröskel:** `FAQ_MATCH_THRESHOLD` (env).  
   - Om träff ≥ threshold → returnera FAQ-svar.  

4. **AI-fallback (GPT-4o):**  
   - `ai.js` kallas endast om FAQ inte ger träff.  
   - Prompt ska innehålla:  
     - Frågan  
     - Språk  
     - **Top-N närliggande FAQ-rader** från Sheets (även under tröskel) för kontext.  
   - Antal FAQ-rader styrs av `FAQ_TOP_K_FOR_AI_CONTEXT`.  

5. **Loggning:**  
   - `logger.js` skriver till:  
     - Flik/tabb **`logs`** i samma Google Sheet.  
     - Alternativt lokalt i `/loggs`.  
   - Fält: `ts`, `lang`, `query`, `source(faq|ai|blocked)`, `match_score`, `latency_ms`, `feedback`.  

---

## 2) Kataloger
- **`/lib`**: logik (FAQ/AI/detect/policy/utils). Inga hårdkodade listor.  
- **`/config`**: BL/WL och keywords per språk (`/config/keywords/*.json`).  
- **`/api`**: tunna endpoints (t.ex. `chat.js`, `healthz.js`, `logs.js`) → anropar `/lib`.  
- **`/public`**: statiska UI-filer (index.html, styles.css, embed.html, chat.html, chat-ui.js).  
- **`/tests`**: modultester, torture-suites, miljö/deploy-skript.  
- **`/faq-extended`**: genererade/utökade FAQ-förslag.  
- **`/översättning`**: pipeline för SE→EN/DA/DE (separat prompt).  

---

## 3) Miljö & drift
- **Dev:** Windows, `vercel dev` (port 3000).  
- **Prod:** Vercel (Functions/Edge).  
- **Env-variabler:**  
  - `OPENAI_API_KEY`  
  - `GCP-SHEETS-FAQ-ID`, `GCP-SHEETS-LOG-ID`, ev. `GCP-DRIVE-FOLDER-ID`  
  - `FAQ_MATCH_THRESHOLD` (t.ex. 0.6)  
  - `FAQ_TOP_K_FOR_AI_CONTEXT` (t.ex. 5)  
  - `ENABLE_AI` (kill-switch)  
  - `LOG_PRIVACY_LEVEL`  

---

## 4) AI-förstärkning via FAQ
- Vid AI-fallback: alltid inkludera **Top-N FAQ-rader från relevanta språkflikar** i Sheets som kontext.  
- Alla AI-fallbacks loggas.  
- Batchscript `generate-faq-updates.js`:  
  - Tar loggar med låg score eller 👎-feedback.  
  - GPT föreslår **nya SE-frågor** + svar.  
  - Skrivs till **`/faq-extended`** eller tabben “suggested” i Sheets.  
  - Auto-kategorisera om `category=saknas`.  
- Alla nya FAQ måste godkännas manuellt.  

---

## 5) UI/UX
- Språkknappar (SE/EN/DA/DE) + auto-detect.  
- Badge som visar källa (FAQ eller AI).  
- Visa “Liknande frågor” från Top-N.  
- Feedbackknappar (👍/👎) → loggas.  
- Copy-knapp, loader, dark/light-mode.  

---

## 6) Säkerhet/robusthet
- XSS-sanering, längdgränser, timeout på API.  
- Rate limiting (IP + session).  
- Gate/BL/WL körs först.  
- Felhantering:  
  - Sheets nere → svara “FAQ otillgänglig just nu”.  
  - AI nere → svara “FAQ kunde inte besvara, AI otillgänglig”.  

---

## 7) Observability
- KPI: FAQ-hit-rate, AI-rate, snittlatency (FAQ/AI), toppfrågor per språk, topp-👎.  
- Endpoints: `/api/healthz`, `/api/diag` (status/version).  

---

## 8) Kodleveransregler
- Fråga alltid om mappstruktur innan imports/exports.  
- Ändra aldrig befintlig logik utan tydlig kommentar.  
- Skicka kod som länk eller per fil.  
- Följ existerande placering: `/tests`, `/lib`, `/api`, `/public`, `/config`.  
