#!/usr/bin/env node
// scripts/warm-cache.mjs
import "../load-env.js"; // laddar .env.local
import { loadFaqCache, initFaqCache } from "../lib/faq-cache.js";

console.log("=== WARM CACHE ===");
try {
  // Läs ev. befintlig cache (för logg + baseline)
  loadFaqCache("warm-cache:preload");

  // Ladda från Google Sheets och slå ihop + skriv endast om ändrat
  await initFaqCache("warm-cache:init");

  console.log("✅ Warm cache complete (see logs/faq-cache.log).");
  process.exit(0);
} catch (err) {
  console.error("❌ Warm cache failed:", err?.message || err);
  process.exit(1);
}
