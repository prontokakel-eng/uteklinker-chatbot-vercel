// tests/test-norm.js
import fetch from "node-fetch";

const API_URL = "http://localhost:3000/api/chat";

const testQuestions = [
  "Kan man lägga 2cm klinker på gräs?",
  "Är tjocka klinkerplattor frosttåliga?",
  "Vilken typ av utomhusplattor är bäst för altan?",
  "Är trädgårdsklinker bra för gångar i trädgården?",
  "Tvåcentimeters klinker funkar väl till utekök?",
  "Passar klinkerdäck för utekök?"
];

const modes = ["STRICT", "SOFT", "FUZZY"];

let normalizedCount = 0;
let aiCount = 0;
let faqCount = 0;

async function runTests() {
  for (const q of testQuestions) {
    console.log("\n===============================");
    console.log("📝 Fråga:", q);

    for (const mode of modes) {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: q, lang: "SE", mode }),
      });

      const data = await res.json();
      console.log(`\n🔎 Mode: ${mode}`);

      if (data.normalizedMessage && data.normalizedMessage !== q) {
        console.log(`   🔄 Normaliserat till: "${data.normalizedMessage}"`);
        normalizedCount++;
      } else {
        console.log("   ℹ️ Ingen normalisering (behölls som den var).");
      }

      if (data.source?.startsWith?.("FAQ")) {
        faqCount++;
        if (data.score < 0.7) {
          console.log(`   ⚠️ FAQ-träff men låg score (${Number(data.score).toFixed(3)})`);
        } else {
          console.log(`   📚 FAQ-träff! Score: ${Number(data.score).toFixed(3)}`);
        }
      } else if (data.source === "AI") {
        console.log("   🤖 Källa: AI (fallback aktiverad)");
        aiCount++;
      } else {
        console.log(`   📌 Källa: ${data.source}`);
      }

      console.log(`   💬 Svar: ${String(data.reply||"").slice(0, 100)}...`);
    }
  }

  console.log("\n===== 📊 Summering =====");
  console.log(`🔄 Normalisering: ${normalizedCount} gånger`);
  console.log(`📚 FAQ användes: ${faqCount} gånger`);
  console.log(`🤖 AI fallback: ${aiCount} gånger`);
}

runTests().catch((err) => console.error("❌ Test error:", err));
