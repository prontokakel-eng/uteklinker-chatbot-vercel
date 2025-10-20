import { detectLangCore as detectLangSafe } from "./detect-lang-core.js";
import { gateMessage } from "./gate.js";
import { searchFaq } from "./faq-data.js";
import { logMessage } from "./logger.js";
import { shouldBlockLong } from "./block-long.js";

// ------------------------------------------------------------
// 🚀 chatPipeline – huvudflöde
// ------------------------------------------------------------
export async function chatPipeline(req, res) {
  const input = (req.body?.text || "").trim();
  const ip = req.ip || req.headers["x-forwarded-for"] || "anon";

  logMessage("chat-pipeline.log", `[START] IP=${ip} text="${input.slice(0, 80)}..."`);

  // 1️⃣ Gate-check
  const gateRes = gateMessage(input, ip);

  // 🧩 Blockera gibberish & short-text direkt
  if (["gibberish", "short-text"].includes(gateRes.via)) {
    return {
      lang: "FILTER",
      via: gateRes.via,
      reply:
        "Din fråga verkar inte innehålla någon relevant text. Försök formulera den tydligare."
    };
  }

  // 🧩 Normalisera alla Gate-blockeringar till FILTER (inte bara blacklist)
  if (gateRes.filtered) {
    const normLang =
      gateRes.via?.includes("blacklist") ||
      gateRes.via?.includes("long-text") ||
      gateRes.via?.includes("rate-limit") ||
      gateRes.via?.includes("gibberish")
        ? "FILTER"
        : "SE";

    return {
      lang: normLang,
      via: gateRes.via,
      reply: gateRes.reason
    };
  }

  // 2️⃣ Självständig LONG/Repetitiv-check (oberoende av Gate)
  const longCheck = shouldBlockLong(input, ip);
  if (longCheck.block) {
    return {
      lang: "FILTER",
      via: longCheck.via,
      reply: longCheck.reason
    };
  }

  // 3️⃣ Språkdetektion
  const langRes = await detectLangSafe(input, ip);
  const lang = langRes.lang || "SE";

  // 4️⃣ FAQ-sökning
  const faqAnswer = await searchFaq(lang, input);
  if (faqAnswer) {
    return {
      lang,
      via: "faq",
      reply: faqAnswer
    };
  }

  // 5️⃣ AI fallback
  logMessage("chat-pipeline.log", `[AI] Fallback triggas IP=${ip}`);
  return {
    lang,
    via: "AI_FALLBACK",
    reply:
      lang === "EN"
        ? "It seems like you're asking something unusual. Could you rephrase?"
        : "Jag är inte säker på vad du menar, kan du formulera frågan på ett annat sätt?"
  };
}
