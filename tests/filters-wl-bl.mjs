// Minimal röktest för WL/BL-normalisering
// Kör: npm run test:filters

import { applyWhitelist, applyBlacklist } from "../lib/wl-bl-filters.js";

function assert(ok, msg) {
  if (!ok) {
    console.error("❌", msg);
    process.exitCode = 1;
  } else {
    console.log("✅", msg);
  }
}

(async function run() {
  // WL: normalisering av storlek 60 x 60 -> 60x60
  const wl60 = applyWhitelist("Har ni 60 x 60 cm uteplattor?", { lang: "SE" });
  assert(wl60?.handled === true && wl60?.via === "whitelist", "WL matchar 60 x 60 cm");

  // WL: 100x100 cm -> 100x100cm
  const wl100 = applyWhitelist("Finns 100x100 cm?", { lang: "SE" });
  assert(wl100?.handled === true && wl100?.via === "whitelist", "WL matchar 100x100 cm");

  // BL: ska blockas
  const bl = applyBlacklist("detta är viagra", { lang: "SE" });
  assert(bl?.handled === true && bl?.via === "blacklist", "BL blockar 'viagra'");

  // WL: ingen träff på ett neutralt sträng (ska INTE whitelistas)
  const wlNone = applyWhitelist("qwerty 123", { lang: "SE" });
  assert(wlNone?.handled === false, "Ingen WL-träff på neutralt ord");

  // Summering/exit
  if (process.exitCode) {
    console.error("Tests failed.");
    process.exit(process.exitCode);
  } else {
    console.log("All tests passed.");
  }
})();
