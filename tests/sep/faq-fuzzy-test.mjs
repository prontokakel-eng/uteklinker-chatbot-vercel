import "../lib/load-env.js";
import { detectLangFaqFuzzy } from "../lib/faq-fuzzy-detect.js";
import { initFaqData } from "../lib/faq-data.js";

async function runTests() {
  console.log("=== 🧪 FAQ Fuzzy Search Test ===\n");

  // ✅ initiera FAQ-data och Fuse-index
  await initFaqData();

  const tests = [
    { input: "Vilka mått har ni?" },
    { input: "How to clean outdoor tiles?" },
    { input: "Kan man lägga plattorna på grus?" },
    { input: "Do you ship internationally?" },
    { input: "Hvordan rengør man terrassefliser?" },
    { input: "Welche Größen gibt es?" },
  ];

  for (const t of tests) {
    const res = detectLangFaqFuzzy(t.input);
    console.log(`🔎 Input: "${t.input}"`);
    if (res) {
      console.log(
        `   ✅ Lang=${res.lang} via=${res.via} match="${res.matches[0].q}" score=${res.matches[0].score.toFixed(
          2
        )}`
      );
    } else {
      console.log("   ❌ Ingen match hittad");
    }
    console.log();
  }
}

runTests();
