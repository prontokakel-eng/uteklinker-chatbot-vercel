// tests/check-healthz.js
// ESM health-check som även värmer/läser FAQ-cachen enligt nya lib/faq-cache.js

import assert from "node:assert/strict";
import { gateMessage } from "../lib/gate.js";
import {
  loadFaqCache,
  initFaqCache,
  getFaqCache,
  getLookupCache,
} from "../lib/faq-cache.js";

function summarize(obj) {
  const zero = { SE: 0, DA: 0, DE: 0, EN: 0 };
  if (!obj || typeof obj !== "object") return zero;
  return {
    SE: Array.isArray(obj.SE) ? obj.SE.length : 0,
    DA: Array.isArray(obj.DA) ? obj.DA.length : 0,
    DE: Array.isArray(obj.DE) ? obj.DE.length : 0,
    EN: Array.isArray(obj.EN) ? obj.EN.length : 0,
  };
}

(async () => {
  console.log("=== HEALTHZ ===");

  // 1) Läs eventuell disk-cache först (ofarligt om fil saknas)
  loadFaqCache("healthz:preload");

  // 2) Försök initiera från Sheets (fail-safas i lib/faq-cache.js)
  await initFaqCache("healthz:init");

  // 3) Summera och visa kort status över FAQ + Lookups
  const faq = getFaqCache();
  const lookups = getLookupCache();
  console.log("[healthz] FAQ:", summarize(faq), "Lookups:", summarize(lookups));

  // 4) Enkel Gate-runda för att säkerställa att pipelinen mår bra
  const res = await gateMessage("ping", "127.0.0.1");
  assert.equal(typeof res, "object");
  // Vi förväntar oss att 'ping' passerar gate (filtered: false)
  assert.equal(res.filtered, false);

  console.log("✅ HEALTHZ PASSED");
})().catch((err) => {
  console.error("❌ HEALTHZ FAILED:", err?.stack || err?.message || err);
  process.exit(1);
});
