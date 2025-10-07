import fs from "fs";
import path from "path";
import { detectLangSafe } from "../lib/detect-lang.js";

// === Ladda testfall ===
const casesPath = path.resolve("tests", "test-cases.json");
const TEST_CASES = JSON.parse(fs.readFileSync(casesPath, "utf8"));

// === Dummy userId (för rate limit) ===
const USER_ID = "test-user";

async function runTests() {
  console.log("=== SAFE Language Detection Tests ===");

  for (const group of Object.keys(TEST_CASES)) {
    console.log(`\n🌍 Testing ${group}`);
    let correct = 0;

    for (const text of TEST_CASES[group]) {
      const result = await detectLangSafe(text, USER_ID, { skipRateLimit: true });

      // Bestäm förväntat språk & metod
      let expectedLang = group;
      let expectedMethod = null;

      if (group === "BLOCK") {
        expectedLang = "FILTER";
        expectedMethod = "blacklist";
      } else if (group === "LONG") {
        expectedLang = "FILTER";
        expectedMethod = "length-check";
      } else if (group === "GIBBERISH") {
        expectedLang = "FILTER";
        expectedMethod = "gibberish";
      }

      const langOk = result.lang === expectedLang;
      const methodOk = expectedMethod ? result.via === expectedMethod : true;

      console.log(
        `📝 "${text.slice(0, 60)}${text.length > 60 ? "..." : ""}"` +
          ` → det=${result.lang} via=${result.via}` +
          ` ${langOk && methodOk ? "✅" : `❌ (expected ${expectedLang}${expectedMethod ? " via " + expectedMethod : ""})`}`
      );

      if (langOk && methodOk) correct++;
    }

    console.log(
      `📊 ${group} accuracy: ${correct}/${TEST_CASES[group].length} (${(
        (correct / TEST_CASES[group].length) *
        100
      ).toFixed(1)}%)`
    );
  }
}

runTests();
