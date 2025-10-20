import { test, expect } from "@playwright/test";

test("smoke: faq-first then AI fallback", async ({ request }) => {
  // Anta en lokal dev endpoint /api/chat under `vercel dev`
  const res = await request.post("http://localhost:3000/api/chat", {
    data: { message: "Hej! Hur installerar jag ..." }
  });
  expect(res.ok()).toBeTruthy();
  const json = await res.json();
  expect(json).toHaveProperty("flow"); // t.ex. ["gates","detect","faq","ai?"]
  expect(json.flow[0]).toBe("gates");
  expect(json.flow[1]).toBe("detect");
  expect(json.flow[2]).toBe("faq");
});
