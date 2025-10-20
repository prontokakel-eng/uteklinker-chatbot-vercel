#!/usr/bin/env node
/**
 * detect-lang-lexicon.test.mjs
 * Sanity-test för lexikon-boost i detect-lang-core.js
 * Kör: node tests/detect-lang-lexicon.test.mjs
 */

import { detectLangCore } from "../lib/detect-lang-core.js";

const samples = {
  SE: [
    "Jag älskar att dricka kaffe på morgonen.",
    "Detta är ett typiskt svenskt uttryck med åäö.",
    "Han gick till affären och köpte mjölk."
  ],
  EN: [
    "I love drinking coffee in the morning.",
    "This is a typical English sentence with common words.",
    "She went to the store and bought milk."
  ],
  DA: [
    "Jeg elsker at drikke kaffe om morgenen.",
    "Dette er en typisk dansk sætning med æøå.",
    "Han gik til butikken og købte mælk."
  ],
  DE: [
    "Ich liebe es, morgens Kaffee zu trinken.",
    "Das ist ein typischer deutscher Satz mit Umlauten.",
    "Er ging in den Laden und kaufte Milch."
  ]
};

console.log("🧩 Lexicon Sanity Test – detect-lang-core.js\n");

for (const [lang, lines] of Object.entries(samples)) {
  console.log(`🔹 Testing ${lang}:`);
  for (const line of lines) {
    const result = await detectLangCore(line, { skipAI: true });
    const entries = Object.entries(result?.scores ?? {});
    const best = entries.sort((a,b) => b[1] - a[1])[0] ?? null;
    const bestStr = best ? `${best[0]} ${Number(best[1]).toFixed(2)}` : "n/a";
    const confStr = typeof result?.confidence === "number" ? result.confidence.toFixed(2) : "n/a";
    console.log(`  "${line.slice(0,40)}..." → ${result.lang} via=${result?.via ?? "n/a"} conf=${confStr} best=${bestStr}`);
  }
  console.log();
}

console.log("✅ Lexicon-boost sanity-check klar!\n");
