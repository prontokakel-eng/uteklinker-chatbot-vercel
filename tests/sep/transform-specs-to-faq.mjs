// transform-specs-to-faq.mjs
import fs from "fs";
import path from "path";

// === Hjälpfunktion för att läsa JSON ===
function loadJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf-8"));
}

// === Generera FAQ från piedestaler ===
function pedestalsToFaq(entries) {
  const faq = [];

  // Samla alla höjdintervall
  const ranges = entries
    .filter((e) => e.height_range_mm)
    .map((e) => e.height_range_mm);

  // Generell fråga
  faq.push({
    question_se: "Vilka höjder på fötter har ni?",
    answer_se: `Vi erbjuder fötter med följande höjdintervall: ${ranges.join(", ")}.`,
    source: "specs_pedestals.json",
    category: "piedestaler"
  });

  // Scenariobaserad fråga
  faq.push({
    question_se: "Jag har en specifik höjd, t.ex. 40 mm eller 355 mm, vilken fot ska jag välja?",
    answer_se: "Kontrollera vilken höjd du har och välj den fot vars justerbara intervall täcker detta mått. Exempel: 40 mm → 35–50 mm, 355 mm → 330–550 mm.",
    source: "specs_pedestals.json",
    category: "piedestaler"
  });

  // Tillbehör
  entries
    .filter((e) => e.tool_name)
    .forEach((e) => {
      faq.push({
        question_se: `Vilket tillbehör används: ${e.tool_name}?`,
        answer_se: e.description || "",
        source: "specs_pedestals.json",
        category: "verktyg och tillbehör"
      });
    });

  return faq;
}

// === Generera FAQ från plattor ===
function tilesToFaq(entries) {
  const faq = [];

  entries.forEach((e) => {
    // Färger
    if (e.colors?.length) {
      faq.push({
        question_se: `Vilka färger finns för plattor i storlek ${e.size_text}?`,
        answer_se: e.colors.join(", "),
        source: "specs_tiles.json",
        category: "färg"
      });
    }

    // Storlekar
    faq.push({
      question_se: "Vilka storlekar finns i 20 mm tjocklek?",
      answer_se: `${e.size_text}`,
      source: "specs_tiles.json",
      category: "storlek"
    });

    // Antal fötter/m²
    if (e.pedestals_per_m2) {
      faq.push({
        question_se: `Hur många fötter behövs per m² för plattor i storlek ${e.size_text}?`,
        answer_se: `${e.pedestals_per_m2} st/m²`,
        source: "specs_tiles.json",
        category: "piedestaler"
      });
    }
  });

  return faq;
}

// === Main ===
function main() {
  const pedestals = loadJson("./faq-extended/specs_pedestals.json");
  const tiles = loadJson("./faq-extended/specs_tiles.json");

  // Just nu kör vi bara SE, men kan enkelt utökas till EN/DA/DE
  const lang = "SE";

  // Piedestals
  const faqPedestals = {};
  faqPedestals[`${lang}_PED`] = pedestalsToFaq(pedestals);
  fs.writeFileSync(
    path.join("./faq-extended", `faq_from_pedestals_${lang.toLowerCase()}.json`),
    JSON.stringify(faqPedestals, null, 2),
    "utf-8"
  );

  // Tiles
  const faqTiles = {};
  faqTiles[`${lang}_PLAT`] = tilesToFaq(tiles);
  fs.writeFileSync(
    path.join("./faq-extended", `faq_from_tiles_${lang.toLowerCase()}.json`),
    JSON.stringify(faqTiles, null, 2),
    "utf-8"
  );

  console.log("✅ Skapat språk-specifika FAQ-filer:");
  console.log("- faq_from_pedestals_se.json (flik SE_PED)");
  console.log("- faq_from_tiles_se.json (flik SE_PLAT)");
}

main();
