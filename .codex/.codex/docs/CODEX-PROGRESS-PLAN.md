# CODEX — Progress & Plan

## Mål
- 90–95% korrekt språkdetektion (SE/EN/DA/DE).
- Stabil gate-pipeline med tidig WL/BL.
- Ren repo & tydliga tester.
- Prod-klar drift på Vercel med korrekt env-hantering.

## Status (2025-10-09)
✅ Implementerat
- WL/BL ombyggt med säker ALL-hantering och smart match (alfabetisk vs format).
- formats/sizes normalisering → kanoniska `XXxYYcm`.
- gate-pipeline omordnad: WL → BL → gibberish → kortord → greeting → detectLangCore(IP-hint) → rate-limit.
- NEUTRAL-ord laddas (för test/heuristik).
- Röktester för WL/BL, formats och gate (PowerShell).
- Dokumentationsstruktur: MASTER + modulära docs.

🟡 Pågående / Nästa
1) **Språkdetekt precision**
   - Finjustera `detectLangCore` regler.
   - Lägg till fler kortordsregler där det hjälper.
2) **Repo-städning**
   - Ta bort `- kopia.js`/”old”-filer som inte längre används.
   - Säkra exports/imports (t.ex. endast en `gate.js` i drift).
3) **Tester**
   - Samla alla röktester i CI-körning (GitHub Actions).
   - Lägg in fler negativa/positiva fall: VPN/IP-hint, blandade format, edge-cases.
4) **FAQ-fallback**
   - Dokumentera “AI-svar cache → FAQ” vägen.
   - Markera svarskällan (FAQ vs AI) i logg & ev. API-respons.
5) **BL-härdning**
   - Lägg till fler spam/fraud-termer per språk (utan att riskera falska positiva).
   - Överväg tunable nivåer (mild/strict) via env-flagga.

## Definition of Done
- Alla `test:smoke` gröna lokalt och i CI.
- Gate-logik och WL/BL dokumenterad (FILTERS.md).
- Prod-deploy (Vercel) med korrekta env och grundloggar utan brus.
- Minimerad teknisk skuld (dupplikat/legacy borttagna).

## Snabb “Codex prompt” (arbete/kontext)
> **Context:** Uteklinker chatbot. Lägg fokus på filtret (WL/BL/NEU) och gate-pipeline. Språk: SE/EN/DA/DE. Formats/sizes normalisering till kanoniska `XXxYYcm`.
> **Tasks:** Håll WL-ALL säker (alfabetiska ALL-termer kräver språkets WL). Numeriska/format ALL-termer gäller globalt. I `gate` kör WL→BL→gibberish→kortord→greeting→detectLangCore(IP-hint)→rate-limit.  
> **Outputs:** Korta, korrekta svar. Logga tydligt (`filters.log`, `gate.log`). Testa med smoke-scripts.  
> **Constraints:** Undvik falska positiva på vanliga funktionsord. Blockera tydligt spam/fraud. IP-hint får ej blockera legitima VPN-användare.  
> **Success:** 90–95% språkträff, gröna röktester, stabil prod.
