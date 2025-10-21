// /api/chat.js — uses TTL-styrd init (initIfStale) + optional force refresh + robust mapping + START2
import { chatPipeline } from "../lib/chatPipeline.js";
import { initFaqCache, initIfStale } from "../lib/faq-cache.js";
import { logMessage } from "../lib/logger.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  const reqId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

  try {
    // START2: undvik att krocka med äldre [START]-mätning
    logMessage?.(
      "chat-pipeline.log",
      `[START2] reqId=${reqId} text="${String(req.body?.text || "").slice(0, 40)}..."`
    );

    // ── Cache bootstrap: TTL-styrd som default, men tillåt force-refresh vid behov
    const forceRefresh =
      (req.query && req.query.refresh === "1") ||
      req.headers?.["x-refresh-cache"] === "1" ||
      req.body?.refreshCache === true;

    if (forceRefresh) {
      await initFaqCache(`api/chat#${reqId}:force`);
    } else {
      // Använder env FAQ_CACHE_TTL_HOURS (default 4h) inne i lib/faq-cache.js
      await initIfStale({ caller: `api/chat#${reqId}` });
    }

    // Kör befintlig pipeline (ska INTE själv skriva till res)
    const result = await chatPipeline(req, res);

    // Robust toText
    const asText = (x) => {
      if (x == null) return "";
      if (typeof x === "string") return x;
      if (typeof x === "object") {
        return (
          x.answer ??
          x.text ??
          x.content ??
          (Array.isArray(x) ? x.map(asText).filter(Boolean).join("\n") : "")
        );
      }
      return String(x ?? "");
    };

    const viaOrSource = String(result?.source ?? result?.via ?? "").toLowerCase();

    let reply = "";
    if (typeof result?.reply === "string") {
      reply = result.reply;
    } else if (Array.isArray(result?.reply)) {
      reply =
        viaOrSource === "faq"
          ? asText(result.reply[0]) || ""
          : result.reply.map(asText).filter(Boolean).join("\n");
    } else {
      reply = asText(result?.reply) || "";
    }

    const prettyVia = (() => {
      const v = viaOrSource;
      if (!v) return null;
      if (v === "faq") return "FAQ";
      if (v.startsWith("ai")) return "AI";
      if (v.includes("filter")) return "FILTER";
      if (v === "fuzzy") return "~FUZZY";
      return result?.source ?? result?.via ?? null;
    })();

    return res.json({
      ...result,
      source: prettyVia,
      reply,
      reqId,
      cache: forceRefresh ? "force-refresh" : "ttl-init",
    });
  } catch (err) {
    logMessage?.(
      "chat-pipeline.log",
      `ERROR reqId=${reqId} ${err?.stack || err?.message || err}`
    );
    return res.status(500).json({ error: "Internal Server Error", reqId });
  }
}
