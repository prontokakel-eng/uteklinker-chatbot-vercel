// /api/chat.js

import { chatPipeline } from "../lib/chatPipeline.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { text } = req.body || {};
  if (!text || typeof text !== "string") {
    return res.status(400).json({ error: "No input text provided" });
  }

  const ip =
    req.headers?.["x-forwarded-for"]?.split(",")[0]?.trim() ||
    req.socket?.remoteAddress ||
    "anon";

  try {
    const result = await chatPipeline(req, res);
    return res.json(result);
  } catch (err) {
    console.error("💥 ChatPipeline error:", err?.message || err);
    return res.status(500).json({ error: "Internal server error" });
  }
}
