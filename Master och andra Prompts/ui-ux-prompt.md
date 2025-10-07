# Prompt för UI/UX-modulen

**Roll:** Frontend-utvecklare.  
**Uppgift:** Skapa/uppdatera UI-filer för chatboten (`index.html`, `styles.css`, ev. `embed.html`, `chat-ui.js`).  

## Krav
- **Komponenter:**  
  - Inputfält + submit-knapp.  
  - Chatfönster med rader för frågeställare + svar.  
  - Språkvalsknappar (SE/EN/DA/DE).  
  - Badge som visar om svaret kom från FAQ eller AI.  
  - Feedbackknappar (👍/👎).  
  - Copy-knapp.  
  - Loader (t.ex. “...” bubbla).  
  - Dark/light-toggle.  

- **Teknik:**  
  - Vanilla JS (ingen bundler).  
  - HTML5 + separat CSS.  
  - Allt ska prata med `/api/chat.js`.  

- **Designprinciper:**  
  - Responsiv layout (mobil först).  
  - Tillgänglighet (ARIA, fokusmarkering).  
  - Minimalistiskt men modernt.  

## Regler
- Skicka alltid kompletta filer (`index.html`, `styles.css`) vid ändringar.  
- Kommentera ändringar tydligt i koden.  
- Ändra aldrig logik i API-anrop – UI ska bara konsumera `/api/chat.js`.  
