/**
 * ============================================================
 *  DETECT-LANG PIPELINE
 *
 *  Syfte:
 *   - Endast språkdetektion (SE, DA, DE, EN, UNKNOWN)
 *   - Ingen filterlogik här (blacklist/whitelist/gibberish hanteras i gate.js)
 *
 *  Flöde:
 *
 *  [Text Input]
 *       │
 *       ▼
 *  ┌───────────────┐
 *  │ regexDetect   │  → fångar specialtecken (åäö, æø, üß)
 *  └───────┬───────┘
 *          │
 *          ▼
 *  ┌───────────────────┐
 *  │ heuristicDetect   │ → anchors + whitelist boost
 *  └─────────┬─────────┘
 *            │
 *            ▼
 *   ┌──────────────────┐
 *   │ brand-neutral    │ → neutraliserar SE om "klinker/klinkerdäck"
 *   └──────────────────┘
 *            │
 *            ▼
 *   ┌──────────────────┐
 *   │ AI fallback (GPT)│ → används om skipAI=false & låg confidence
 *   └──────────────────┘
 *            │
 *            ▼
 *        [Result JSON]
 *        {
 *          lang: "SE|DA|DE|EN|UNKNOWN",
 *          via: "regex|heuristic|heuristic+anchors|brand-neutral|ai-fallback",
 *          confidence: 0..1,
 *          NeedsAI: bool,
 *          matches: [...]
 *        }
 *
 *  📌 Viktigt:
 *   - detect-lang.js gör ALDRIG filter/blockering
 *   - gate.js kör alltid först
 * ============================================================
 */

/**
 * detect-lang.js
 *
 * Tunn wrapper runt detectLangCore.
 * - Default = skipAI i testläge (process.env.TEST_MODE === "true")
 * - I prod används AI fallback (skipAI = false).
 */

import { detectLangCore } from "./detect-lang-core.js";

export async function detectLangSafe(input, user = "anon", opts = {}) {
  // Om vi kör i testläge → hoppa över AI
  const skipAI = process.env.TEST_MODE === "true";

  return detectLangCore(input, { skipAI, ...opts });
}

