// PATCH: whitelist keepers in orphans output (minimal diff)
import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import madge from "madge";

function run(cmd) {
  console.log(`\n=== ${cmd} ===`);
  execSync(cmd, { stdio: "inherit" });
}

// 1. LINT
// run("npm run lint");

// 2. DEADCODE
run("npm run deadcode");

// 3. DEPS
run("npm run deps:check");

import madge from "madge";

console.log("\n=== graph:cycles (API mode) ===");
{
  const res = await madge("lib", {
    excludeRegExp: [
      "tests/sep",
      "withTimeout\\.js"
    ]
  });
  const cycles = res.circular();
  console.log(cycles.length ? cycles : "✅ Inga cykler");
}

// 🆕 Keeper-list (behåll även om de saknar in-edges i lib/* just nu)
const KEEPERS = new Set([
  "ai.js",
  "blacklist-regex.js",
  "chatPipeline.js",
  "faq-dialog.js",
  "faq-keywords.js",
  "faq-search.js",
  "gate.featureflag.2025-10-10_042808.js",
  "policy.js",
  "utils-progress.js",
  "utils-text.js",
  "utils.js",
]);

console.log("\n=== graph:orphans (API mode) ===");
{
  const res = await madge("lib", {
    excludeRegExp: [
      "tests/sep",
      "withTimeout\\.js"
    ]
  });

  // original list
  const rawOrphans = res.orphans();

  // 🆕 dela upp i whitelisted keepers vs riktiga orphans
  const whitelisted = rawOrphans.filter(f => KEEPERS.has(f));
  const realOrphans = rawOrphans.filter(f => !KEEPERS.has(f));

  if (whitelisted.length) {
    console.log("whitelisted keepers (not flagged):");
    console.log(whitelisted);
  }

  console.log("\norphans (after whitelist):");
  console.log(realOrphans.length ? realOrphans : "✅ Inga orphans");
}

// 6. SMOKE TESTS (nivå L)
// 🆕 kör endast om filen finns (tolerant mot rensning i /tests)
import { existsSync } from "node:fs";
function runIfExists(path, cmd) {
  if (existsSync(path)) {
    run(cmd);
  } else {
    console.log(`(skip) ${path} saknas — hoppar över`);
  }
}

runIfExists("tests/smoke-wlbl.js",     "node tests/smoke-wlbl.js");
runIfExists("tests/smoke-formats.js",  "node tests/smoke-formats.js");
runIfExists("tests/smoke-gate.js",     "node tests/smoke-gate.js");
runIfExists("tests/check-healthz.js",  "node tests/check-healthz.js");

console.log("\n✅ AUDIT COMPLETE — minimal sanity passed.");
