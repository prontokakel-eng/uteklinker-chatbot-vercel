# Master Prompt

## Arkitektur och huvudflöde
FAQ-först chatbot med AI-fallback. Flödet är deterministiskt och bygger på filter, språkdetektion och fallback till AI vid behov.

### Huvudflöde
Gate & Filters → detect-lang → FAQ (Fuse.js) → block-long → AI-fallback (med top-N FAQ-kontext) → loggning

### Modulöversikt
- gate.js – första spärren (längd, BL/WL, gibberish, rate-limit)
- filters.js – textanalys, relevans, hälsningar, fuzzy-match
- block-long.js – human-likeness-analys av långa eller repetitiva texter
- detect-lang.js – AI-baserad språkdetektion
- detect-lang-rules.js – regex-baserad snabbdetektion
- faq-data.js – Fuse.js-sökning i FAQ
- chatPipeline.js – central styrning av hela flödet
- logger.js – enhetlig loggning
- rate-limiter.js – IP-baserad throttling

## Språkdetektion
Språkdetektionen är hybridbaserad:
1. AI-modell analyserar sannolikhet per språk.
2. Fallback till `detect-lang-rules.js` med heuristik och regex.
3. IP-baserad språkdetektion används enbart som tiebreaker vid låg AI-konfidens.

Målvärden:
- Utan IP: ≥ 90–95 % korrekt språkidentifiering.
- Med IP: 100 % korrekthet.

Alla språkresultat loggas med `lang.confidence` och `lang.source`.

## Tester
- `chatBot-torture-mini.mjs`: snabb sanity-test, alltid 0 mismatch.
- `chatBot-torture-test-v4.mjs`: fulltest (>1000 case) med export till Google Sheets.
- Alla loggar hamnar i `/tests/logs/` med tidsstämplar.

## Loggning
Standardformat: `[YYYY-MM-DDTHH:mm:ss.sssZ] [id=<reqID>] [component] <message>`  
Loggfiler: `gate.log`, `chat-pipeline.log`, `torture-*.log`, `mismatch-report.csv`.

## Säkerhet och drift
- Gate, BL/WL och Rate-limit körs före språkdetektion.
- Ingen nyckel exponeras klientside.
- Hantera fel för både AI och Sheets.
- Anti-spam via `block-long.js` och `rate-limiter.js`.

## Mätpunkter
- FAQ hit rate (%)
- AI fallback rate
- Lang-detection accuracy
- Genomsnittlig latens (ms)
- Rate-limit triggers per IP
