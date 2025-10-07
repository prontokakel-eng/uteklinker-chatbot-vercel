// lib/faq-cache.js
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { loadAllFaqData } from "./faq-sheets.js"; // ✅ ändrat hit

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CACHE_FILE = path.join(__dirname, "..", "logs", "faq-cache.json");

let faqCache = { SE: [], DA: [], DE: [], EN: [] };

// --- Ladda cache från fil ---
export function loadFaqCache() {
  if (fs.existsSync(CACHE_FILE)) {
    try {
      const raw = fs.readFileSync(CACHE_FILE, "utf-8");
      faqCache = JSON.parse(raw);
      console.log(`[faq-cache] ✅ FAQ-cache laddad från fil:`, {
        SE: faqCache.SE?.length || 0,
        DA: faqCache.DA?.length || 0,
        DE: faqCache.DE?.length || 0,
        EN: faqCache.EN?.length || 0,
      });
    } catch (err) {
      console.error("💥 Kunde inte läsa FAQ-cache:", err.message);
    }
  }
  return faqCache;
}

// --- Spara cache till fil ---
export function saveFaqCache() {
  try {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(faqCache, null, 2));
    console.log("[faq-cache] 💾 FAQ-cache sparad.");
  } catch (err) {
    console.error("💥 Kunde inte spara FAQ-cache:", err.message);
  }
}

// --- Uppdatera cache från Google Sheets ---
export async function refreshFaqCache() {
  try {
    const data = await loadAllFaqData();
    faqCache = data;
    saveFaqCache();
    console.log(`[faq-cache] 🔄 FAQ-cache uppdaterad:`, {
      SE: faqCache.SE.length,
      DA: faqCache.DA.length,
      DE: faqCache.DE.length,
      EN: faqCache.EN.length,
    });
  } catch (err) {
    console.error("💥 Kunde inte uppdatera FAQ-cache:", err.message);
  }
  return faqCache;
}

// --- Hämta FAQ för språk ---
export function getFaq(lang = "SE") {
  return faqCache[lang] || [];
}

// --- Initiera cache vid start ---
export async function initFaqCache() {
  loadFaqCache();
  if (
    !faqCache.SE?.length &&
    !faqCache.DA?.length &&
    !faqCache.DE?.length &&
    !faqCache.EN?.length
  ) {
    console.log("[faq-cache] 🚀 Ingen cache hittades, laddar från Sheets...");
    await refreshFaqCache();
  }
  return faqCache;
}
