// /tests/faq-data-test.mjs
import fs from "fs";
import path from "path";
import "../lib/load-env.js";
import { buildFaqIndex, searchFaq } from "../lib/faq-data.js";
import { loadFaqCache } from "../lib/faq-cache.js";
import { initKeywords, searchFaqWithKeywords, matchKeywords } from "../lib/faq-keywords.js";

const logFile = path.resolve("./faq-test-log.txt");
fs.writeFileSync(logFile, "=== 🧪 FAQ Data Test (Keywords + Fuse) ===\n\n", "utf8");

// Helper för att logga både till konsol och fil
function log(...args) {
  const msg = args.join(" ");
  console.log(msg);
  fs.appendFileSync(logFile, msg + "\n", "utf8");
}

async function runTests() {
  log("=== 🧪 FAQ Data Test (Keywords + Fuse) ===\n");

  // Ladda cache + index + keywords
  loadFaqCache();
  buildFaqIndex();
  await initKeywords();

  const tests = [
    { lang: "SE", input: "Vilka mått har ni?" },
    { lang: "EN", input: "How to clean outdoor tiles?" },
    { lang: "SE", input: "Kan man lägga plattorna på grus?" },
    { lang: "EN", input: "Do you ship internationally?" },
    { lang: "DA", input: "Hvordan rengør man terrassefliser?" },
    { lang: "DE", input: "Welche Größen gibt es?" },
    // Extra testfall
    { lang: "SE", input: "Kan man använda salt på plattorna?" },
    { lang: "EN", input: "Do you offer home delivery?" },
    { lang: "DA", input: "Tilbyder I hjemlevering?" },
    { lang: "DE", input: "Kan man skære pladerne?" },
    // ❌ Testfall som medvetet inte ska matcha
    { lang: "EN", input: "Blablabla random nonsense question?" },
  ];

  let stats = { keyword: 0, keywordFuse: 0, fuse: 0, miss: 0 };

  for (const t of tests) {
    log(`🔎 [${t.lang}] Input: "${t.input}"`);

    const kws = matchKeywords(t.lang, t.input);
    if (kws.length > 0) {
      log(`   🏷 Keywords hittade: ${kws.join(", ")}`);
    }

    const res =
      searchFaqWithKeywords(t.lang, t.input) ||
      searchFaq(t.lang, t.input);

    const qText = res?.q || res?.question;
    const aText = res?.a || res?.answer;

    if (qText) {
      const score = typeof res.score === "number" ? res.score.toFixed(2) : "n/a";
      log(`   ✅ Match (${res.source || "fuse"}): "${qText}" (score=${score})`);
      if (aText) {
        log(`      💬 Svar: ${aText}`);
      }

      // hitta avgörande keyword
      const decisive = kws.find(kw =>
        qText.toLowerCase().includes(kw.toLowerCase()) ||
        (aText && aText.toLowerCase().includes(kw.toLowerCase()))
      );
      if (decisive) {
        log(`      ⭐ Avgörande keyword: ${decisive}`);
      }

      if (res.source === "keyword") {
        stats.keyword++;
      } else if (res.source === "keyword+fuse") {
        stats.keywordFuse++;
      } else {
        stats.fuse++;
      }
    } else {
      log("   ❌ Ingen match hittad");
      stats.miss++;
    }
    log(""); // tom rad
  }

  // Summering
  log("=== 📊 Summering ===");
  log(`Keyword-träffar (exakt): ${stats.keyword}`);
  log(`Keyword+Fuse-träffar:   ${stats.keywordFuse}`);
  log(`Fuse-träffar:           ${stats.fuse}`);
  log(`Missar:                 ${stats.miss}`);
  log(
    `Totalt:                 ${tests.length} (Coverage: ${(
      ((stats.keyword + stats.keywordFuse + stats.fuse) / tests.length) *
      100
    ).toFixed(1)}%)`
  );

  log(`\n📂 Logg sparad till: ${logFile}`);
}

runTests();
