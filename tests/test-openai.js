// /api/test-openai.js
import OpenAI from "openai";

export default async function handler(req, res) {
  try {
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    // Gör ett enkelt API-anrop – listar modeller
    const models = await openai.models.list();

    return res.status(200).json({
      success: true,
      modelCount: models.data.length,
      firstModels: models.data.slice(0, 3).map(m => m.id), // returnera de första 3
    });
  } catch (err) {
    console.error("❌ OpenAI test misslyckades:", err);
    return res.status(500).json({
      success: false,
      error: err.message,
    });
  }
}
