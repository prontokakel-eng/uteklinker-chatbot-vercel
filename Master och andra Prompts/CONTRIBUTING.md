# docs/CONTRIBUTING.md

## 🎯 Syfte
Den här guiden beskriver hur du sätter upp projektet lokalt, kör våra kvalitetskontroller (audit), och öppnar en PR enligt vårt flöde.

---

## 🧰 Förutsättningar
- Node.js 20.x
- npm 10.x
- Git
- (Valfritt) VS Code + ESLint/Prettier-plugins

---

## 🚀 Kom igång

```bash
git clone <repo-url>
cd uteklinker-chatbot-vercel
npm ci
```

Miljöfiler:
- Prod/hemligheter hanteras utanför repo. Lokala tester kräver inga specials.
- Loggar skrivs till `logs/` och rapporter till `logs/reports/`.

---

## 🌿 Branch-strategi
- Utgå från `main`.
- Skapa feature-branch: `feature/<kort-namn>` eller fix-branch: `fix/<kort-namn>`.
- Små, fokuserade PR:er > stora “godzilla”-PR:er.

---

## 📝 Commits
- Skriv kort och beskrivande:
  - `feat: …`, `fix: …`, `chore: …`, `docs: …`, `refactor: …`, `test: …`
- En commit per logisk ändring, gärna med hänvisning till issue/ärende.

---

## 🧪 Test & Audit

Snabbkör allt:
```bash
npm run audit && npm run test:lang
```

Vad **audit** gör:
1) **Deadcode (knip)** – scope: `lib/**`, ignorerar `archive/**`, `_deprecated/**`, `scripts/**`, `tests/**`.  
2) **Depcheck** – oanvända beroenden.  
3) **Graph (madge)** – cykler och orphans; “keepers” listas separat.  
4) **Smoke/Health** – lätta sanity-kontroller (skippar saknade filer).  

Separat:
```bash
npm run deadcode     # endast knip
npm run deps:check   # endast depcheck
npm run test:lang    # språk-gatens fulltest
```

> Tips: `logs/*.log` visar Gate/Filters/detect-lang flöde.

---

## 🧹 Orphan-policy
- Kod som pausas/ersätts → `_deprecated/**`.
- Historik/experiment → `archive/**`.
- Vissa moduler är **keepers** (används indirekt/dynamiskt) och whitelistas i `scripts/audit-runner.js`:
  ```
  ai.js, blacklist-regex.js, chatPipeline.js, faq-dialog.js, faq-keywords.js,
  faq-search.js, gate.featureflag.2025-10-10_042808.js, policy.js,
  utils-progress.js, utils-text.js, utils.js
  ```
- Lägg inte dev-verktyg i `lib/**` – använd `scripts/**`.

---

## 🔎 Tracing (felsökning av imports)
Valfritt: aktivera ESM/CJS-trace lokalt.

PowerShell:
```powershell
$env:NODE_OPTIONS = '--require ./scripts/trace-cjs.cjs'
node --experimental-loader ./scripts/trace-esm.mjs tests/detect-lang-fulltest.mjs
Remove-Item Env:NODE_OPTIONS
```

---

## ✅ PR-flöde
1. **Synka main** och rebase din branch.
2. Kör lokalt:
   ```bash
   npm run audit && npm run test:lang
   ```
3. Se till att **inga nya orphans** tillkommer (om de behövs → whitelist i `scripts/audit-runner.js` med motivering).
4. Fyll i **PR-templatet** (`.github/pull_request_template.md`):
   - Sammanfattning
   - Checklista (audit + test:lang grönt)
   - Test & verifiering (relevanta loggutdrag)
   - Städrutiner (scripts/**, _deprecated/**, archive/**)
5. Vänta på grön CI och minst en review.

---

## 🚢 Release
- När FAS/feature är klar, uppdatera `CHANGELOG.md`.
- Tagga (om aktuellt):
  ```bash
  git tag -a vX.Y.Z -m "Kort sammanfattning"
  git push origin main --tags
  ```

---

## 🧯 Vanliga fallgropar
- **Windows/ESM**: absolut loader-sökväg kräver `file://` – använd relativa vägar som i exemplen.
- **CRLF/LF**: Git kan varna vid commit – det är okej, repo standardiserar till LF.
- **Smoke-filer saknas**: audit-runner skippar dem; skapa dem bara om du faktiskt behöver testet.

---

## 🤝 Kodstil & struktur (kort)
- ESM-moduler i `lib/**`
- Minimal logging till `logs/*.log` via `logMessage()`
- Inga “engångsskript” i `lib/**` – lägg i `scripts/**`
- Håll Gate/Filters deterministiska; undvik nätverksanrop i testade banor

---

## 📫 Frågor
Öppna en diskussion/issue eller pinga i teamets kanal.  
Tack för ditt bidrag! 🙌
