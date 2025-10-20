// /lib/ai.js
import OpenAI from "openai";
import "./load-env.js";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  project: process.env.OPENAI_PROJECT_ID, // 🧩 krävs för sk-proj-nycklar
});

// Generera AI-svar (sparas EJ automatiskt)
export async function generateAiReply(message) {
  const aiResponse = await openai.chat.completions.create({
    model: "gpt-4o", // ✅ rätt modellnamn
    messages: [
      {
        role: "system",
        content: "Du är en hjälpsam kundsupportagent för byggprodukter.",
      },
      { role: "user", content: message },
    ],
  });

  return aiResponse.choices[0].message.content.trim();
}
