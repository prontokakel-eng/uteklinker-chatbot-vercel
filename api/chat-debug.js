// /api/chat-debug.js
import { logMessage } from "../lib/logger.js";
import OpenAI from "openai";
import stringSimilarity from "string-similarity";
import { getFaqCache } from "../lib/faq-cache.js";
import { containsWhitelistWord } from "../lib/utils.js";
import { detectLangSafe } from "../lib/detect-lang.js";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const LOG_FILE = "dev-chat-debug.log";
function logToFile(msg) {
  logMessage(LOG_FILE, msg);
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", ["POST"]);
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  try {
    // --- BODY parse ---
    let body = req.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch (e) {
        logToFile(`❌ JSON parse error: ${e.message}`);
        return res.status(400).json({ success: false, error: "Invalid JSON" });
      }
    }

    const { text } = body || {};
    if (!text) {
      return res.status(400).json({ success: false, error: "Missing text" });
    }

    // --- SPRÅK ---
    let finalLang = "SE";
    try {
      const { lang: detectedLang, via } = await detectLangSafe(text);
      if (["SE", "EN", "DA", "DE"].includes(detectedLang)) {
        finalLang = detectedLang;
      }
      logToFile(`🌍 detectLangSafe: det=${detectedLang} via=${via} | final=${finalLang} | input="${text}"`);
    } catch (e) {
      logToFile(`💥 detectLangSafe error: ${e.stack}`);
    }

    // --- WHITELIST ---
    if (!containsWhitelistWord(text, finalLang)) {
      logToFile(`FILTER → Not related (${finalLang}) | Input="${text}"`);
      return res.status(200).json({
        success: true,
        reply: "⚠️ Din fråga verkar inte relatera till våra produkter.",
        source: "FILTER",
      });
    }

    // --- FAQ ---
    let faqs = [];
    try {
      const FAQ_CACHE = await getFaqCache();
      faqs = FAQ_CACHE?.[finalLang] || [];
      logToFile(`📚 FAQ-cache(${finalLang}) count=${faqs.length}`);
    } catch (e) {
      logToFile(`💥 getFaqCache error: ${e.stack}`);
    }

    let bestMatch = null;
    if (faqs.length > 0) {
      try {
        const questions = faqs.map(f => f.question);
        const matches = stringSimilarity.findBestMatch(text, questions);
        if (matches.bestMatch.rating > 0.6) {
          bestMatch = {
            reply: faqs[matches.bestMatchIndex].answer,
            score: matches.bestMatch.rating,
            source: `FAQ_${finalLang}`,
          };
          logToFile(`✅ FAQ HIT: Q="${faqs[matches.bestMatchIndex].question}" score=${matches.bestMatch.rating}`);
        }
      } catch (e) {
        logToFile(`💥 FAQ match error: ${e.stack}`);
      }
    }

    // --- AI fallback ---
    if (!bestMatch) {
      logToFile(`🤖 AI fallback (${finalLang}) input="${text}"`);
      try {
        const response = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [
            { role: "system", content: "Du är en FAQ-bot för Uteklinker." },
            { role: "user", content: text },
          ],
          max_tokens: 300,
        });
        bestMatch = {
          reply: response.choices?.[0]?.message?.content?.trim() || "(no answer)",
          score: 1,
          source: "AI",
        };
      } catch (e) {
        logToFile(`💥 OpenAI error: ${e.stack}`);
        return res.status(500).json({
          success: false,
          error: "OpenAI API call failed",
          details: e.message,
        });
      }
    }

    // --- RETURN ---
    logToFile(`FINAL reply source=${bestMatch.source} | reply="${bestMatch.reply.slice(0, 60)}..."`);
    return res.status(200).json({ success: true, ...bestMatch });

  } catch (err) {
    logToFile(`💥 Outer error: ${err.stack}`);
    return res.status(500).json({ success: false, error: err.message });
  }
}
