// ai-fallback.js
import { getOpenAIClient } from "./openai-client.js";
import { searchFaq } from "./faq-data.js";

/**
 * Kallar GPT-4o som fallback med FAQ-kontext
 * @param {string} userInput - frågan från användaren
 * @param {string} lang - språk (SE, EN, DA, DE)
 */
export async function askAI(userInput, lang = "SE") {
  try {
    // hämta top-3 FAQ som kontext
    const nearbyFaqs = searchFaq(lang, userInput, { limit: 3 }) || [];
    const context = nearbyFaqs
      .map((f, i) => `${i + 1}. Q: ${f.question}\nA: ${f.answer}`)
      .join("\n\n");

    const messages = [
      {
        role: "system",
        content: `You are a helpful assistant. Always answer in ${lang}.
If relevant, use the following FAQs as context:\n\n${context}`,
      },
      { role: "user", content: userInput },
    ];

    const completion = await getOpenAIClient().chat.completions.create({
      model: "gpt-4o",
      messages,
      temperature: 0.3,
    });

    return completion.choices[0].message.content.trim();
  } catch (err) {
    console.error("⚠️ AI fallback failed:", err.message);
    return "Tyvärr kunde jag inte hitta ett svar just nu.";
  }
}
