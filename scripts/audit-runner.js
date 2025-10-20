import { execSync } from "node:child_process";

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

console.log("\n=== graph:orphans (API mode) ===");
{
  const res = await madge("lib", {
    excludeRegExp: [
      "tests/sep",
      "withTimeout\\.js"
    ]
  });
  const orphans = res.orphans();
  console.log(orphans.length ? orphans : "✅ Inga orphans");
}


// 6. SMOKE TESTS (nivå L)
run("node tests/smoke-wlbl.js");
run("node tests/smoke-formats.js");
run("node tests/smoke-gate.js");
run("node tests/check-healthz.js");

console.log("\n✅ AUDIT COMPLETE — minimal sanity passed.");
