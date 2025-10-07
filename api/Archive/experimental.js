// lib/experimental.js
import OpenAI from "openai";
import { containsAllowedWord, normalizeMessage } from "./../lib/utils.js";
import { findBestMatch } from "./faq.js";

const FAQ_THRESHOLD = 0.7;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function chatHandlerExperimental(req, res) {
  try {
    const { message, lang = "SE", mode = "STRICT" } = req.body;
    if (!message || typeof message !== "string") {
      return res.status(400).json({ error: "Ogiltig fråga" });
    }

    console.log("📥 /api/chat (experimental) kallad. Body:", req.body);
    console.log("🔎 Match mode:", mode);

    // ✅ Normalisera (utan synonymer)
    const normalizedMessage = normalizeMessage(message);
    console.log("✅ normalizedMessage:", normalizedMessage);

    // 1) Validation
    if (!containsAllowedWord(normalizedMessage, lang)) {
      return res.json({
        reply:
          "Din fråga är inte relaterad till våra produkter, vänligen omformulera.",
        source: "Validation",
      });
    }

    // 2) FAQ Match
    const match = findBestMatch(normalizedMessage, lang);
    if (match && match.score >= FAQ_THRESHOLD) {
      return res.json({
        reply: match.match.answer || "❌ FAQ-svar saknas",
        source: `FAQ (${mode})`,
        score: match.score,
        normalizedMessage,
      });
    }

    // 3) AI Fallback
    const aiResponse = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: "Du är en hjälpsam kundsupportagent för byggprodukter." },
        { role: "user", content: normalizedMessage },
      ],
    });

    const reply = aiResponse.choices[0].message.content;
    return res.json({ reply, source: "AI", score: 0, normalizedMessage });
  } catch (err) {
    console.error("💥 Experimental handler error:", err);
    res.status(500).json({ error: "Server error" });
  }
}
