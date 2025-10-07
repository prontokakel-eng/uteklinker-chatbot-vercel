import { saveFaqReply } from "../lib/utils.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const { question, reply, lang } = req.body;

    if (!question || !reply || !lang) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    await saveFaqReply(question, reply, lang);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error("❌ save-faq-reply error:", err.message);
    return res.status(500).json({ error: "Failed to save FAQ reply" });
  }
}
