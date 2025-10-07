# README – Kod-prompts

Detta är en samling promtar för att styra utvecklingen av FAQ-chatboten.

## Struktur
- `system-prompt.md` → Grundregler, ramar och kodstandard. Ska alltid användas som systeminstruktion.  
- `master-prompt.md` → Full arbetsmanual för chatbotens backend och logik.  
- `oversattning-prompt.md` → För batchöversättning av SE-frågor till EN/DA/DE + keywords.  
- `ui-ux-prompt.md` → För att bygga och uppdatera UI (HTML/CSS/JS).  

## Användning
1. **System Prompt** → Klistra in först i en ny session. Ger spelreglerna.  
2. **Master Prompt** → Använd när du vill bygga backend/chatbotlogik. Klistra in i samma session som System Prompt.  
3. **Översättningsprompt** → Starta en separat session, klistra in prompten och mata in SE-frågor. Output går direkt till Sheets.  
4. **UI/UX-prompt** → Starta en separat session för frontend, klistra in prompten och ge din uppgift (t.ex. “lägg till copy-knapp”).  

## Tips
- Versionera promtarna (`v1`, `v2` …).  
- Håll `/kod` uppdaterad i samma repo som chatboten, så är alltid dokumentationen nära till hands.  
