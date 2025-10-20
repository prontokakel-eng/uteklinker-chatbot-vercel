import fs from "fs";
import path from "path";
import { detectLang } from "../lib/detect-lang.js";

// Ladda testfall från JSON
const casesPath = path.resolve("tests", "test-cases.json");
const TEST_CASES = JSON.parse(fs.readFileSync(casesPath, "utf8"));

async function runTests() {
  console.log("=== AI + Whitelist + Blacklist + Regex Language Detection Tests ===");

  for (const lang of Object.keys(TEST_CASES)) {
    console.log(`\n🌍 Testing ${lang}`);
    let correct = 0;

    for (const text of TEST_CASES[lang]) {
      const result = await detectLang(text);

      if (lang === "BLOCK") {
        const blocked = result.lang === "FILTER";
        console.log(
          `📝 "${text}" → ${
            blocked ? `❌ BLOCKED via ${result.method}` : `⚠️ ALLOWED via ${result.method}`
          }`
        );
        if (blocked) correct++;
      } else {
        const ok = result.lang === lang;
        console.log(
          `📝 "${text}" → det=${result.lang} via=${result.method} ${
            ok ? "✅" : `❌ (expected ${lang})`
          }`
        );
        if (ok) correct++;
      }
    }

    console.log(
      `📊 ${lang} accuracy: ${correct}/${TEST_CASES[lang].length} (${(
        (correct / TEST_CASES[lang].length) *
        100
      ).toFixed(1)}%)`
    );
  }
}

runTests();
