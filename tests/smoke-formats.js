console.log("=== SMOKE: FORMATS ===");

function ensure(val, label) {
  if (!val) {
    console.error(`❌ Format check FAILED: ${label}`);
    process.exit(1);
  }
}

ensure(typeof JSON.stringify({ a: 1 }) === "string", "JSON stringify");
ensure("hej".toUpperCase() === "HEJ", "String uppercase");

console.log("✅ SMOKE FORMATS PASSED");
process.exit(0);
