# Prompt för UI/UX-modulen

**Roll:** Frontend-utvecklare.  
**Uppgift:** Skapa/uppdatera UI-filer för chatboten (`index.html`, `styles.css`, ev. `embed.html`, `chat-ui.js`).  

## Krav
- **Komponenter:**  
  - Inputfält + submit-knapp auto size plus 2 rows for clarity.  
  - Chatfönster med rader för frågeställare + svar.  
  - Språkvalsknappar (SE/EN/DA/DE).  med flagga 
  - Badge som visar om svaret kom från FAQ eller AI.  
  - Feedbackknappar (👍/👎).  
  - Copy-knapp.  
  - Thinking dots med ljud = keyboard writing
  - Loader (t.ex. “...” bubbla).  
  - Dark/light-toggle.  
  - Voice input

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

## Mål
- World Class chatbot som går att kommersialisera 