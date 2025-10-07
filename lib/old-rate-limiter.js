// /lib/rate-limiter.js
import LRU from "lru-cache";
import fs from "fs";
import path from "path";

const requests = new LRU({ max: 10000, ttl: 60 * 1000 }); // 1 min TTL

// Slow limiter
const DEFAULT_LIMIT = parseInt(process.env.RATE_LIMIT || "7", 10);
const DEFAULT_WINDOW = parseInt(process.env.RATE_LIMIT_WINDOW || "60000", 10);

// Fast limiter
const FAST_LIMIT = parseInt(process.env.RATE_LIMIT_FAST || "3", 10);
const FAST_WINDOW = parseInt(process.env.RATE_LIMIT_FAST_WINDOW || "5000", 10);

// Whitelist
const WHITELIST_IPS = (process.env.RATE_LIMIT_WHITELIST || "")
  .split(",")
  .map((ip) => ip.trim())
  .filter(Boolean);

// === Loggning till /tests/logs/ ===
const LOG_DIR = path.join(process.cwd(), "tests", "logs");
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
const LOG_FILE = path.join(LOG_DIR, `rate-limiter-${new Date().toISOString().slice(0,10)}.log`);

function logToFile(line) {
  fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${line}\n`, { encoding: "utf8" });
}

// --- intern helper ---
function check(ip, limit, windowMs) {
  const now = Date.now();
  const history = requests.get(ip) || [];
  const recent = history.filter((t) => now - t < windowMs);
  recent.push(now);
  requests.set(ip, recent);
  return recent.length > limit;
}

export function checkRateLimit(ip = "anon") {
  // 🛡️ Test mode bypass
  if (process.env.TEST_MODE === "true") {
    const msg = `Bypass p.g.a. TEST_MODE ip=${ip}`;
    console.warn(`[RateLimiter] ${msg}`);
    logToFile(msg);
    return { limited: false, reason: msg, via: "rate-limit-off" };
  }

  // 🛡️ Whitelist bypass
  if (WHITELIST_IPS.includes(ip)) {
    const msg = `Bypass p.g.a. whitelist (${ip})`;
    console.warn(`[RateLimiter] ${msg}`);
    logToFile(msg);
    return { limited: false, reason: msg, via: "rate-limit-whitelist" };
  }

  // 🚀 Fast limiter först
  if (check(ip + "-fast", FAST_LIMIT, FAST_WINDOW)) {
    const msg = `🚫 FAST block ip=${ip} (max ${FAST_LIMIT} per ${FAST_WINDOW/1000}s)`;
    console.warn(`[RateLimiter] ${msg}`);
    logToFile(msg);
    return { limited: true, reason: msg, via: "rate-limit-fast" };
  }

  // 🐢 Sedan slow limiter
  if (check(ip + "-slow", DEFAULT_LIMIT, DEFAULT_WINDOW)) {
    const msg = `🚫 SLOW block ip=${ip} (max ${DEFAULT_LIMIT} per ${DEFAULT_WINDOW/1000}s)`;
    console.warn(`[RateLimiter] ${msg}`);
    logToFile(msg);
    return { limited: true, reason: msg, via: "rate-limit-slow" };
  }

  // ✅ Pass
  const msg = `✅ Pass ip=${ip} (under gräns)`;
  logToFile(msg);
  return { limited: false, reason: msg, via: "rate-limit-pass" };
}
