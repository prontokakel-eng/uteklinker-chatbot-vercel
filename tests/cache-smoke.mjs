// tests/cache-smoke.mjs
import assert from "node:assert/strict";
import { get, set, invalidate, makeCacheKey, getStats, clearAll } from "../lib/faq-cache.js";

// Dummy loader (imtiterar långsam fetch)
async function slow(value, ms = 50) {
  await new Promise((r) => setTimeout(r, ms));
  return value;
}

clearAll();
const key = makeCacheKey({ sheetId: "S", range: "FAQ!A:Z", ver: "v1" });

// 1) Miss -> load
const t0 = Date.now();
const v1 = await get(key, { ttl: 100, swrTtl: 400, loader: () => slow({ rows: 1 }, 30) });
assert.equal(v1.rows, 1);

// 2) Fresh hit
const v2 = await get(key, { ttl: 100, swrTtl: 400, loader: () => slow({ rows: 2 }, 30) });
assert.equal(v2.rows, 1);

// 3) Vänta så vi hamnar i SWR-fönstret
await new Promise((r) => setTimeout(r, 150));
const v3 = await get(key, { ttl: 100, swrTtl: 400, loader: () => slow({ rows: 3 }, 30) });
assert.equal(v3.rows, 1, "SWR ska lämna gammalt värde direkt");

// Ge bakgrundsladdning tid
await new Promise((r) => setTimeout(r, 80));

// 4) Ny hit: ska vara uppdaterad
const v4 = await get(key, { ttl: 100, swrTtl: 400 });
assert.equal(v4.rows, 3);

// 5) Invalidate och tvinga ny load
invalidate(key);
const v5 = await get(key, { ttl: 100, swrTtl: 400, loader: () => slow({ rows: 5 }, 5) });
assert.equal(v5.rows, 5);

console.log("Stats:", getStats());
console.log("✅ cache-smoke passed");
