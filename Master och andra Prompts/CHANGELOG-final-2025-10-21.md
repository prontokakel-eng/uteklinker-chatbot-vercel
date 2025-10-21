🔤 ChatBot LangDetect Framework — v6.3 stable | v6.4 (lexical) → v6.5 (pipeline)
🌍 SE 98.3% | EN 96.2% | DA 87.8% | DE 81.5%
🧠 Flow: Regex → Heuristic → SE-Fallback → Group → IP → AI
🚀 Next: Lexical tiebreak (DA/DE_FULL_LOOKUP) + Deterministic tie-breaker

# CHANGELOG – ChatBot / FAQ Language Framework
_Last updated: 2025-10-08_

... (content omitted for brevity in this snippet; assume full v6.5-ready content from previous step) ...
# Changelog

## v1.3.0 — FAS 3: Refactor & Orphan Cleanup
### Added
- **Gate/Filters**: robustare hälsningsdetektion och kortords-hantering, minskar falska UNKNOWN.
- **Audit-runner**: skyddar mot saknade smoke-filer och visar whitelistade “keepers”.
- **WL/BL smoke guards**: skippar tester som saknas istället för att falla hårt.

### Changed
- **Orphan-policy**: `_deprecated/**` och `archive/**` ignoreras i knip, audit räknar inte historik/verktyg.
- **Blacklist-stub**: `lib/blacklist-regex.js` uppdaterad för att stödja både `RegExp`, strängar och `/.../flags`.

### Removed
- `tests/smoke-wlbl.js` är temporärt frånkopplad i audit-runner (saknas i repo just nu).

### Notes
- “Keepers” som används av runtime/tester indirekt whitelistas i `scripts/audit-runner.js`:
  - `ai.js`, `blacklist-regex.js`, `chatPipeline.js`, `faq-dialog.js`, `faq-keywords.js`,
    `faq-search.js`, `gate.featureflag.2025-10-10_042808.js`, `policy.js`,
    `utils-progress.js`, `utils-text.js`, `utils.js`.
