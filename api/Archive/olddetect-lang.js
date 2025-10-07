// /api/detect-lang.js
// ⚠️ Deprecated endpoint: används inte längre av UI.
// Språkdetektering sker nu direkt i /api/chat.js via /lib/detect-lang.js.
// Den här filen finns bara kvar för test/debug.

import { detectLangSafe } from "../lib/detect-lang.js";

export default function handler(req, res) {
  try {
    const text = req.body?.text || "";
    const result = detectLangSafe(text);
    // ✅ returnera både lang och method för transparens
    res.status(200).json(result);
  } catch (err) {
    console.error("Language detection error:", err);
    res.status(500).json({ error: "Language detection failed" });
  }
}
