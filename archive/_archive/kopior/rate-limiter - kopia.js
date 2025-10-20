// 🧩 /lib/rate-limiter.js
// Enkel, lokal rate-limiter för Gate

import fs from "fs";
import path from "path";
import { logMessage } from "./logger.js";

// Loggfil per dag
const LOG_DIR = "./logs";
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

const LOG_FILE = path.join(
  LOG_DIR,
  `rate-limiter-${new Date().toISOString().slice(0, 10)}.log`
);

// Minnesbaserad request-store
const requests = new Map();

// ⚙️ Konfiguration
const WINDOW_MS = 60 * 1000; // 1 minut
const MAX_REQ = 10; // max 10 requests per IP per minut
const WHITELIST = ["127.0.0.1", "::1"]; // undantag
const BLACKLIST = []; // framtida spärrar

/**
 * checkRateLimit(ip)
 * Enkel limiter baserad på request-tidsstämplar.
 */
export async function checkRateLimit(ip = "0.0.0.0") {
  const now = Date.now();

  if (BLACKLIST.includes(ip)) {
    const msg = `IP blacklisted: ${ip}`;
    logMessage("gate.log", `🚫 ${msg}`);
    return { limited: true, reason: msg, via: "rate-limit-blacklist" };
  }

  if (WHITELIST.includes(ip)) {
    const msg = `IP whitelisted: ${ip}`;
    logMessage("gate.log", `✅ ${msg}`);
    return { limited: false, reason: msg, via: "rate-limit-whitelist" };
  }

  // Hämta tidigare requests
  const times = requests.get(ip) || [];
  const recent = times.filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  requests.set(ip, recent);

  // Kontrollera antal requests inom tidsfönster
  if (recent.length > MAX_REQ) {
    const msg = `Rate limit exceeded for ${ip} (${recent.length}/${MAX_REQ})`;
    fs.appendFileSync(LOG_FILE, `${new Date().toISOString()} 🚫 ${msg}\n`);
    return { limited: true, reason: msg, via: "rate-limit-slow" };
  }

  // OK
  const msg = `Allowed (${recent.length}/${MAX_REQ}) for ${ip}`;
  fs.appendFileSync(LOG_FILE, `${new Date().toISOString()} ✅ ${msg}\n`);
  return { limited: false, reason: msg, via: "rate-limit-pass" };
}
