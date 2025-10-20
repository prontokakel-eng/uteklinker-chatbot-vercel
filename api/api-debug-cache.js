// /api/debug-cache.js — diagnostics for FAQ cache usage (read-only)
import { getFaqCache, getLookupCache } from "../lib/faq-cache.js";
import fs from "fs";
import path from "path";

export default async function handler(req, res) {
  try {
    const faq = getFaqCache();
    const lookups = getLookupCache();

    const count = (arr) => Array.isArray(arr) ? arr.length : 0;
    const summary = {
      pid: process.pid,
      uptime_s: Math.round(process.uptime()),
      cwd: process.cwd(),
      cache_file: path.join(process.cwd(), "faq-cache.json"),
      cache_file_exists: fs.existsSync(path.join(process.cwd(), "faq-cache.json")),
      faq_counts: {
        SE: count(faq.SE), DA: count(faq.DA), DE: count(faq.DE), EN: count(faq.EN)
      },
      lookup_counts: {
        SE: count(lookups.SE), DA: count(lookups.DA), DE: count(lookups.DE), EN: count(lookups.EN)
      }
    };

    res.status(200).json(summary);
  } catch (e) {
    res.status(500).json({ error: e.message || String(e) });
  }
}
