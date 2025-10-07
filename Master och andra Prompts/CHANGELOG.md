# CHANGELOG – ChatBot Torture Framework

## Datum
2025-10-05

## Översikt
Stabilitets- och filtreringsuppdatering med fokus på deterministiskt beteende under torture-tester.

## Nya moduler
- block-long.js – analyserar långa och repetitiva texter före AI.
- Förbättrad WL/BL-hantering i filters.js.
- gate.js har fått mer detaljerad loggning och deterministisk blockering.
- chatPipeline.js inkluderar LONG-guard för icke-mänskliga texter.

## Tester
- torture-mini: 0 mismatch, deterministisk körning.
- torture-v4: ~1000 testfall, export till Google Sheets.

## Miljövariabler
- TEST_CASES_FILE
- SHEET_TAB_NAME / SHEET_TAB_NAME_PROD
- SHEET_TAB_ID_TEST_TORTURE / TEST_TORT_PROD

## Resultat
- AI-fallback eliminerad för långa och blockerade scenarier.
- Systemet uppvisar deterministiska resultat mellan körningar.
- Klar för nästa steg: Human-likeness scoring.
