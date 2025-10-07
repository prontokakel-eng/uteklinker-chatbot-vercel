// 🧩 detect-lang-test.mjs
// Kombinerad testfil: core-mode (snabb) & debug-mode (detaljerad)
// Kör: node detect-lang-test.mjs

import chalk from "chalk";
import "../lib/load-env.js";
import { detectLangCore } from "../lib/detect-lang-core.js";
import { detectLangRulesOnly } from "../lib/detect-lang-rules.js";
import { detectLangHeuristicGroup } from "../lib/detect-lang-heuristics.js";

// Ändra läge här: "core" = snabb CI-test, "debug" = utvecklarläge
const MODE = "debug"; // "core" | "debug"

const tests = [
  // Svenska
  { text: "Måste jag skydda klinkerdäcket från frost?", expected: "SE" },
  { text: "Vilka mått gäller för plattorna?", expected: "SE" },
  { text: "Hej", expected: "SE" },
  { text: "Varför är klinkerdäck så dyra?", expected: "SE" },

  // Danska
  { text: "Kan jeg bruge klinker udenfor?", expected: "DA" },
  { text: "Hvilken garanti har jeg?", expected: "DA" },
  { text: "æøå test", expected: "DA" },
  { text: "Hvilken klinker passer bedst?", expected: "DA" },

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
  { text: "Hej, how are you?", expected: "EN" },

  // Gibberish / korta
  { text: "asdfghjklqwertyuiop", expected: "UNKNOWN" },
  { text: "1234567890 !@#¤%", expected: "UNKNOWN" },
  { text: "a", expected: "UNKNOWN" },
  { text: "x", expected: "UNKNOWN" },
  { text: "?", expected: "UNKNOWN" },

  // Korta riktiga ord
  { text: "Ja", expected: "SE" },
  { text: "Hi", expected: "EN" },
];

(async () => {
  console.log(chalk.bold(`\n🧩 Språkdetektion – ${MODE === "debug" ? "Debugläge" : "Coreläge"} (skipAI=true)`));
  console.log("--------------------------------------------------------\n");

  let mismatches = 0;
  for (const t of tests) {
    const input = t.text;
    const expected = t.expected;
    const core = await detectLangCore(input, { skipAI: true });

    let rules, heur;
    if (MODE === "debug") {
      rules = await detectLangRulesOnly(input);
      heur = detectLangHeuristicGroup(input);
    }

    const ok = core.lang === expected || (expected === "UNKNOWN" && core.lang === "UNKNOWN");
    const status = ok ? chalk.green("PASS") : chalk.red("FAIL");

    console.log(chalk.white.bold(`🧠 "${input}"`));
    console.log(`   Expected: ${expected}`);

    if (MODE === "debug") {
      console.log(`   Regex/Rules: ${rules.lang} (${rules.via}, conf=${rules.confidence})`);
      console.log(`   HeuristicGrp: ${heur.lang} (${heur.via}, conf=${heur.confidence})`);
    }

    console.log(`   Core result: ${core.lang} (${core.via}, conf=${core.confidence})`);
    console.log(`   → ${status}\n`);

    if (!ok) mismatches++;
  }

  console.log(chalk.bold("--------------------------------------------------------"));
  console.log(
    chalk.bold(`📊 Totalt mismatches: ${mismatches} av ${tests.length}`)
  );
  console.log(chalk.bold("--------------------------------------------------------\n"));
  console.log(chalk.gray("Tips: Ändra MODE i toppen till 'core' för snabbtest."));
})();
