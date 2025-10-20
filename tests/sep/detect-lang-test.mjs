import "../lib/load-env.js";
import { detectLangCore } from "../lib/detect-lang-core.js";

const tests = [
  // Svenska
  { text: "Måste jag skydda klinkerdäcket från frost?", expected: "SE" },
  { text: "Vilka mått gäller för plattorna?", expected: "SE" },
  { text: "Hej", expected: "SE" },

  // Danska
  { text: "Kan jeg bruge klinker udenfor?", expected: "DA" },
  { text: "Hvilken garanti har jeg?", expected: "DA" },
  { text: "æøå test", expected: "DA" },

  // Tyska
  { text: "Muss ich die Fliesen gegen Frost schützen?", expected: "DE" },
  { text: "Welche Maße haben Sie?", expected: "DE" },
  { text: "üß test", expected: "DE" },
  { text: "Muss ich klinker auf der Terrasse verlegen?", expected: "DE" },

  // Engelska
  { text: "How do I protect tiles from frost?", expected: "EN" },
  { text: "What sizes do you have available?", expected: "EN" },
  { text: "Hi", expected: "EN" },
  { text: "Can I install klinker outside?", expected: "EN" },

  // Blandat
  { text: "Hej, how are you?", expected: "EN" },
  
  // Gibberish
  { text: "asdfghjklqwertyuiop", expected: "UNKNOWN" },
  { text: "1234567890 !@#¤%", expected: "UNKNOWN" },

  // 🆕 Extra korta inputs (ska bli UNKNOWN)
  { text: "a", expected: "UNKNOWN" },
  { text: "x", expected: "UNKNOWN" },
  { text: "?", expected: "UNKNOWN" },

  // 🆕 Korta riktiga ord (ska funka)
  { text: "Ja", expected: "SE" },
  { text: "Hi", expected: "EN" },
];

(async () => {
  console.log("=== 🔎 Test med skipAI=true (ingen AI) ===");
  await runTests(true);

  console.log("\n=== 🤖 Test med skipAI=false (AI-fallback aktiv) ===");
  await runTests(false);
})();

async function runTests(skipAI) {
  let mismatches = 0;

  for (const t of tests) {
    const res = await detectLangCore(t.text, { skipAI });
    const got = res.lang;
    const ok = got === t.expected;

    if (!ok) mismatches++;

    console.log(
      `${ok ? "✅" : "❌"} "${t.text}" → detected=${res.lang} via=${res.via} | expected=${t.expected} | confidence=${res.confidence} | NeedsAI=${res.NeedsAI}`
    );
  }

  console.log(
    `\n🟩 Test klart (skipAI=${skipAI}).` +
    `\n📊 Totalt mismatches: ${mismatches} av ${tests.length}\n`
  );
}
