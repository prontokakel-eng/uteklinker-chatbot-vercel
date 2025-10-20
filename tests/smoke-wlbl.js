import patterns from "../config/blacklist-patterns.json" assert { type: "json" };
import { blacklistRegexMatch } from "../lib/blacklist-regex.js";

console.log("=== SMOKE: WL/BL ===");

// 1) Testa att ofarlig text INTE triggar blacklist
const safe = blacklistRegexMatch("hello world");
if (safe?.hit) {
  console.error("❌ SMOKE FAILED: safe input was blacklisted");
  process.exit(1);
}

// 2) Testa att minst ett blacklist-mönster faktiskt matchar något
const firstPattern = patterns[0]?.pattern;
if (!firstPattern) {
  console.error("❌ SMOKE FAILED: no patterns found in blacklist-patterns.json");
  process.exit(1);
}

// testa blacklist med första mönstret
const testInput = "b a n k i d";
const bl = blacklistRegexMatch(testInput);

if (!bl?.hit) {
  console.error(`❌ SMOKE FAILED: blacklist did not trigger on pattern: ${firstPattern}`);
  process.exit(1);
}

console.log("✅ SMOKE WL/BL PASSED");
process.exit(0);
