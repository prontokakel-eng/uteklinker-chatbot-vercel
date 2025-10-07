# README – ChatBot Promptstruktur

## Struktur
- system-prompt.md – definierar roll, regler och kodprinciper
- master-prompt.md – backend- och pipelinearkitektur
- oversattning-prompt.md – språk- och översättningsflöden
- ui-ux-prompt.md – frontend och interaktion

## Användning
1. System Prompt används först i session för att definiera utvecklarroll och beteende.
2. Master Prompt används för arbete med backend, tester och logik.
3. Översättningsprompt används vid arbete med FAQ-översättningar.
4. UI/UX Prompt används för frontend och interaktion.

## Arkitektur
Chatboten använder ett FAQ-först-flöde med deterministisk filtrering, språkdetektion och fallback till AI endast vid behov.

Gate & Filters körs före språkdetektion, FAQ och AI.  
Alla tester är deterministiska och loggas till `/tests/logs/`.

## Tester
- `chatBot-torture-mini.mjs`: snabb sanitytest.
- `chatBot-torture-test-v4.mjs`: full regressionskörning mot >1000 frågor.

## Säkerhet
- Gate och Filters skyddar mot spam och bottar.
- Rate-limit förhindrar flood.
- Inga miljövariabler exponeras klientside.

## Drift
Utveckling sker i Node (ESM) på Windows med `vercel dev`.  
Produktion körs på Vercel.  
Alla komponenter följer ESM-standard.
