// scripts/warm-cache.mjs
// Förladdar “heta” FAQ-nycklar så första användaren slipper kallstart.
// Kör: node scripts/warm-cache.mjs

import { getWithVersionedKey } from "../lib/faq-cache.js";

// Byt ut detta mot din riktiga loader:
async function loadFaqFromGoogle({ sheetId, range }) {
  // Här ska du använda befintlig sheets-funktion i projektet.
  // Exempel (pseudokod):
  //   return await fetchFaqSheet(sheetId, range);
  // För demo:
  return { ok: true, rows: 123, at: new Date().toISOString(), sheetId, range };
}

const HOT_KEYS = [
  // Lägg till de vanligaste frågeområdena/ranges här:
  { sheetId: "FAQ_SWEET_SHEET", range: "FAQ!A:Z", lexVer: "v2" },
  { sheetId: "FAQ_SWEET_SHEET", range: "LEXICON!A:Z", lexVer: "v2" },
];

for (const k of HOT_KEYS) {
  const data = await getWithVersionedKey(
    k,
    () => loadFaqFromGoogle({ sheetId: k.sheetId, range: k.range }),
    { ttl: 5 * 60_000, swrTtl: 15 * 60_000 }
  );
  console.log("[warm]", k, "→", typeof data, Array.isArray(data) ? data.length : Object.keys(data || {}).length);
}

console.log("✅ Warm complete.");
