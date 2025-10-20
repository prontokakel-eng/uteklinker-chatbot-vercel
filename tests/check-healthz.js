import { gateMessage } from "../lib/gate.js";

console.log("=== HEALTHZ ===");
try {
  const res = await gateMessage("ping", "127.0.0.1");
  if (!res) throw new Error("Empty response");
  console.log("✅ HEALTHZ PASSED");
  process.exit(0);
} catch (err) {
  console.error("❌ HEALTHZ FAILED:", err.message);
  process.exit(1);
}
