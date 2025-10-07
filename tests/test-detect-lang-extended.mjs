// tests/test-detect-lang-extended.mjs
import { detectLangLocal, setFaqCache } from "../lib/detect-lang.js";

// Mockade FAQ-frågor per språk (både frågor + svar i samma array)
const MOCK_FAQ = {
  SE: [
    "Behöver jag försegla Klinkerdäck?",
    "Hur rengör man uteplattor?",
    "Vi rekommenderar impregnering efter montering."
  ],
  EN: [
    "Do you need to seal Klinkerdäck?",
    "How to clean outdoor tiles?",
    "Yes, the product is frost resistant."
  ],
  DA: [
    "Skal jeg forsegle Klinkerdæk?",
    "Hvordan rengør man terrassefliser?",
    "Ja, produktet er frostsikkert."
  ],
  DE: [
    "Muss ich Klinkerdach versiegeln?",
    "Wie reinigt man Terrassenplatten?",
    "Ja, das Produkt ist frostsicher."
  ],
};

// Initiera FAQ-cache i detect-lang
setFaqCache(MOCK_FAQ);

// Testfraser per språk
const TEST_CASES = {
  SE: [
    "Behöver jag försegla Klinkerdäck?",
    "Hur rengör man uteplattor?",
    "Vad kostar Klinkerdäck?",
    "Kan man använda på altan?",
    "Hur tåliga är klinkerplattorna?",
    "måste jag skydda klinkerdäck från frost?",
    "finns det olika färger av klinkerplattor?",
    "vilka mått har ni?",
    "hur lång garanti lämnar ni?",
    "är produkten CE-märkt?",
  ],
  EN: [
    "Do you need to seal Klinkerdäck?",
    "How to clean outdoor tiles?",
    "What sizes do you offer?",
    "Is it frost resistant?",
    "How durable are the slabs?",
    "Can I use it on a balcony?",
    "Is there a warranty?",
    "Are your products certified?",
    "Do you ship internationally?",
    "How long does delivery take?",
  ],
  DA: [
    "Skal jeg forsegle Klinkerdæk?",
    "Hvordan rengør man terrassefliser?",
    "Er det frostsikkert?",
    "Kan det bruges på altan?",
    "Hvad koster det?",
    "Findes der forskellige farver?",
    "Er der garanti?",
    "Hvor lang er leveringstiden?",
    "Er produktet CE-mærket?",
    "Er klinkerpladerne holdbare?",
  ],
  DE: [
    "Muss ich Klinkerdach versiegeln?",
    "Wie reinigt man Terrassenplatten?",
    "Ist es frostsicher?",
    "Kann man es auf dem Balkon verwenden?",
    "Welche Größen gibt es?",
    "Gibt es verschiedene Farben?",
    "Gibt es eine Garantie?",
    "Wie lange dauert die Lieferung?",
    "Sind die Produkte zertifiziert?",
    "Sind die Platten langlebig?",
  ],
};

async function runTests() {
  console.log("=== Extended Language Detection Tests (with FAQ fallback) ===");

  for (const lang of Object.keys(TEST_CASES)) {
    console.log(`\n🌍 Testing ${lang} (${TEST_CASES[lang].length} cases)`);
    let correct = 0;

    for (const text of TEST_CASES[lang]) {
      const result = await detectLangLocal(text);
      const ok = result.lang === lang;
      if (ok) correct++;

      console.log(
        `📝 "${text}" → det=${result.lang} via=${result.method} ${
          ok ? "✅" : `❌ (expected ${lang})`
        }`
      );
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
