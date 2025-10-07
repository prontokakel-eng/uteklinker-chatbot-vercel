import "../lib/load-env.js";
import { detectLangCore } from "../lib/detect-lang-core.js";

function prettyPrint(res) {
  const flags = {
    SE: "🇸🇪",
    DA: "🇩🇰",
    DE: "🇩🇪",
    EN: "🇬🇧",
    UNKNOWN: "❓",
    SCANDI: "🌍",
    GERMANIC: "🌍",
  };

  const lang = res.lang || "UNKNOWN";
  const flag = flags[lang] || "❓";
  const conf = ((res.confidence || 0) * 100).toFixed(0) + "%";

  const ipNote = res.via.includes("ip-fallback") ? " (← ip-fallback)" : "";
  const clusterNote = res.via.includes("cluster") ? " (← cluster)" : "";
  const grammarNote = res.via.includes("grammar") ? " (← grammar)" : "";
  const aiNote = res.via.includes("AI-fallback") ? " (← AI)" : "";

  return `${flag} Lang=${lang} | via=${res.via}${ipNote}${clusterNote}${grammarNote}${aiNote} | conf=${conf} | NeedsAI=${res.NeedsAI}`;
}

async function runTests() {
  console.log("=== 🧪 Core Language Detection Tests ===\n");

  console.log("=== 🔎 SkipAI=true (Rules only) ===\n");

  console.log("1) IP boost (hi, SE)");
  console.log(prettyPrint(await detectLangCore("hi", { ipCountryCode: "SE", skipAI: true })));

  console.log("1b) IP boost (hej, US)");
  console.log(prettyPrint(await detectLangCore("hej", { ipCountryCode: "US", skipAI: true })));

  console.log("\n2) SCANDI cluster (hej jeg)");
  console.log(prettyPrint(await detectLangCore("hej jeg", { skipAI: true })));

  console.log("\n3) GERMANIC cluster (muss ich och jeg)");
  console.log(prettyPrint(await detectLangCore("muss ich och jeg", { skipAI: true })));

  console.log("\n4) Normal SE");
  console.log(prettyPrint(await detectLangCore("Måste jag skydda klinkerdäcket från frost?", { skipAI: true })));

  console.log("\n5) Normal EN");
  console.log(prettyPrint(await detectLangCore("How do I protect tiles from frost?", { skipAI: true })));

  console.log("\n6) Gibberish (###$$$)");
  console.log(prettyPrint(await detectLangCore("###$$$", { skipAI: true })));

  console.log("\n=== 🤖 SkipAI=false (AI fallback allowed) ===\n");

  console.log("1) IP boost (hi, SE)");
  console.log(prettyPrint(await detectLangCore("hi", { ipCountryCode: "SE", skipAI: false })));

  console.log("1b) IP boost (hej, US)");
  console.log(prettyPrint(await detectLangCore("hej", { ipCountryCode: "US", skipAI: false })));

  console.log("\n2) SCANDI cluster (hej jeg)");
  console.log(prettyPrint(await detectLangCore("hej jeg", { skipAI: false })));

  console.log("\n3) GERMANIC cluster (muss ich och jeg)");
  console.log(prettyPrint(await detectLangCore("muss ich och jeg", { skipAI: false })));

  console.log("\n4) Normal SE");
  console.log(prettyPrint(await detectLangCore("Måste jag skydda klinkerdäcket från frost?", { skipAI: false })));

  console.log("\n5) Normal EN");
  console.log(prettyPrint(await detectLangCore("How do I protect tiles from frost?", { skipAI: false })));

  console.log("\n6) Gibberish (###$$$)");
  console.log(prettyPrint(await detectLangCore("###$$$", { skipAI: false })));
}

runTests();
