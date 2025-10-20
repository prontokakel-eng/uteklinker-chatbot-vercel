// 🧩 /lib/wl-bl-filters.js
// Central whitelist / blacklist filtermodul

import { logMessage } from "./logger.js";

// Enkla exempelord — dessa kan senare laddas från /config
const whitelist = ["hej", "test", "ok"];
const blacklist = ["spam", "hack", "phish", "attack"];

// ✅ Whitelist — tillåter texten
export function applyWhitelist(text = "") {
  const t = text.toLowerCase();
  const hit = whitelist.find((w) => t.includes(w));
  if (hit) {
    logMessage("filters.log", `✅ Whitelist match: ${hit}`);
    return { handled: true, reason: `whitelisted (${hit})`, via: "whitelist" };
  }
  return { handled: false };
}

// 🚫 Blacklist — blockerar texten
export function applyBlacklist(text = "") {
  const t = text.toLowerCase();
  const hit = blacklist.find((w) => t.includes(w));
  if (hit) {
    logMessage("filters.log", `🚫 Blacklist match: ${hit}`);
    return { handled: true, reason: `blacklisted (${hit})`, via: "blacklist" };
  }
  return { handled: false };
}
