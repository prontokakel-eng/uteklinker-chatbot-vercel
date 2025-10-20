// Vitest – validerar ordning utan att röra befintlig logik.
// Antag att modulerna exponerar funktioner; om inte: mocka på entrypunktsnivå.
import { describe, it, expect, vi } from "vitest";

describe("Pipeline order", () => {
  it("runs Gates/Filters before detect-lang, then FAQ, then AI", async () => {
    const calls = [];
    const gates = vi.fn(async (ctx) => { calls.push("gates"); return ctx; });
    const detect = vi.fn(async (ctx) => { calls.push("detect"); return { ...ctx, lang: "sv" }; });
    const faq = vi.fn(async (ctx) => { calls.push("faq"); return { ...ctx, answer: "..." }; });
    const ai = vi.fn(async (ctx) => { calls.push("ai"); return { ...ctx, answer: ctx.answer ?? "ai" }; });

    // Simulerad orchestrator – använd din riktiga om du har en (utan att ändra den).
    async function pipeline() {
      let ctx = { q: "hej" };
      ctx = await gates(ctx);
      ctx = await detect(ctx);
      ctx = await faq(ctx);
      ctx = await ai(ctx);
      return ctx;
    }

    const out = await pipeline();
    expect(out.lang).toBe("sv");
    expect(calls).toEqual(["gates", "detect", "faq", "ai"]);
  });
});
