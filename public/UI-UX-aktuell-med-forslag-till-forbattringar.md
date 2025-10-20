# UI/UX – aktuell status & förslag till förbättringar

_Senast uppdaterad: idag_

## Det vi har nu (UI/UX)
- Språkval: flaggknappar (SE/EN/DA/DE) + select, sync och `aria-pressed`.
- Auto-språkdetektion + banner: **OBS! ⚠️ Din fråga verkar vara på {språk} – vi bytte språk till {flagga} {kod}.**
- Inputfält (Enter=skicka) + send-knapp; Shift+Enter = radbryt.
- Röstinmatning (Web Speech) beroende på valt språk.
- Tangent-“typing”-ljud med **mute-toggla** (status sparas).
- Loader (… tre punkter), “Skriver…” i SR-only region (tillgänglighet).
- Chat-bubblor med badges: ✅ FAQ / 🤖 AI / Filter.
- Markdown-rendering (bold/italic, länkar, `inline code`, ```code```), **kopiera kod**-knapp.
- **Kopiera senaste svar**-knapp.
- **Retry** (skicka om senaste fråga) & **Förbättra svaret** (FAQ→AI-fallback med FAQ som kontext).
- **Streaming-stöd** (text/event-stream/chunk), fallback till JSON.
- **Scroll lock** + **Hoppa till senaste**-knapp.
- **Ny konversation**-knapp (med bekräftelse).
- **Toasts**: offline/online, felmeddelanden via status-banner.

## Förslag – nästa steg
1. **Citations/Källor** i UI (hover/expander) när `source` innehåller metadata/URL:er.
2. **Svarslängd**-toggle (Kort/Standard/Utförligt) – skickas som hint i payload.
3. **Snabbchips** under input (“Förtydliga”, “Visa exempel”, “Lista punkter”). 
4. **Undo språkbyte** (återställ till tidigare UI-språk).
5. **Session-namn** & historik (lokalt: IndexedDB) + “Fortsätt senaste”.
6. **Tidsstämplar** på meddelanden (lokal tid, kortformat).
7. **Tillgänglighetsförbättringar**: fokusfällor, ESC för att stänga banners.
8. **Teman**: Auto (prefers-color-scheme), Light/Dark, samt kompakt läge.
9. **Felhantering**: 429 (rate limit) → UI-tip “Försök igen om 30s”; 5xx → “Växla till AI/FAQ”.
10. **Ping/health-indikator** (liten grön punkt när /health OK).
11. **Spam/abuse-gates** UI-hint (om servern flaggar “FILTER”).
12. **Exportera konversation** (kopiera allt som Markdown/JSON).
13. **Inline bildförhandsvisning** om svar innehåller bild-URL:er.
14. **Anpassad typography** (systemfontstack, bättre läsbarhet i mobiler).
15. **Korta keyboard-shortcuts**-overlay (K): Enter/Shift+Enter, Ctrl/Cmd+K fokus, Ctrl+Enter skicka.

––
För att aktivera någon punkt: säg t.ex. “Implementera 1,4,6” så gör vi **minsta möjliga diff** i `chat.html` + `chat-ui.js`.
