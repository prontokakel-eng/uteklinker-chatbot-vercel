import fs from "fs";

// Input: outputen från scrape (kör först: node tests/scrape-pronto.mjs)
const raw = JSON.parse(fs.readFileSync("pronto-farger.json", "utf-8"));

const faqs = [];
for (const [serie, data] of Object.entries(raw)) {
  const färger = (data.färger || []).map(f => f.namn).filter(Boolean);
  const unikaFärger = [...new Set(färger)];
  if (unikaFärger.length === 0) continue;

  // Bygg svarstext + lista format per färg
  const rows = (data.färger || [])
    .filter(f => f.namn)
    .map(f => `- ${f.namn}${f.klass ? ` (${f.klass})` : ""}${(f.format && f.format.length) ? ` – format: ${[...new Set(f.format)].join(", ")}` : ""}`)
    .join("\n");

  faqs.push({
    question_se: `Vilka färger finns i serien ${serie}?`,
    answer_se: `Följande färger finns i ${serie}:\n${rows}`,
    source: "prontokakel.starwebserver.se",
    category: "Färger"
  });
}

// Spara som fristående FAQ-fil (SE-format)
fs.writeFileSync("faq_colors_from_pronto_se.json", JSON.stringify(faqs, null, 2), "utf-8");
console.log(`✅ Skapade faq_colors_from_pronto_se.json med ${faqs.length} färg-FAQ:er.`);
