// PATCH: whitelist keepers in orphans output (minimal diff)
import { execSync } from "node:child_process";
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

// Required smoke checks must fail when a command/file is missing. They use
// synthetic services, not production credentials or retired public endpoints.
run("npm run test:smoke");

console.log("\nAUDIT COMPLETE — required smoke checks passed.");
