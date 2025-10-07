// lib/ai.js
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Generera AI-svar (sparas EJ automatiskt)
export async function generateAiReply(message) {
  const aiResponse = await openai.chat.completions.create({
    model: "o",
    messages: [
      {
        role: "system",
        content: "Du är en hjälpsam kundsupportagent för byggprodukter.",
      },
      { role: "user", content: message },
    ],
  });

  return aiResponse.choices[0].message.content;
}
