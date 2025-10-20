import { gateMessage } from "../lib/gate.js";

console.log("=== SMOKE: GATE ===");

try {
  const res = await gateMessage("Hello", "127.0.0.1");
  if (!res) throw new Error("no response");
  console.log("✅ SMOKE GATE PASSED");
  process.exit(0);
} catch (err) {
  console.error("❌ GATE smoke FAILED:", err.message);
  process.exit(1);
}
