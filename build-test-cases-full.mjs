import fs from "fs";
import path from "path";
import { parse } from "csv-parse/sync";
import { fileURLToPath } from "url";
import archiver from "archiver";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const csvFiles = {
  SE: "Faq + keywords SE DA EN DE - FAQ_SE (4).csv",
  EN: "Faq + keywords SE DA EN DE - FAQ_EN (1).csv",
  DA: "Faq + keywords SE DA EN DE - FAQ_DA (1).csv",
  DE: "Faq + keywords SE DA EN DE - FAQ_DE (1).csv",
};

// helper
const tortureGen = {
  LONG: () =>
    Array.from({ length: 20 }, (_, i) => ({
      input:
        "Detta är en väldigt lång text nummer " +
        (i + 1) +
        " som innehåller massor av utfyllnad för att simulera mänskligt skräp " +
        "blandat med ord som klinker, fog, platta, men egentligen är den alldeles för lång för att vara relevant. ".repeat(
          5
        ),
      expected: "FILTER",
    })),
  BLOCK: () =>
    [
      "cheap viagra free money",
      "lottery scam claim prize",
      "porn links click here",
      "earn $5000 fast",
      "bitcoin get rich now",
      "credit card hack tool",
      "fake passport service",
      "casino jackpot guaranteed",
      "win iphone now",
      "adult cam chat",
    ].map((s) => ({ input: s, expected: "FILTER" })),
  GIBBERISH: () =>
    Array.from({ length: 20 }, () => ({
      input: Math.random().toString(36).slice(2, 20).repeat(3),
      expected: "FILTER",
    })),
  GREETING: () => [
    { input: "hej", expected: "SE" },
    { input: "hejhej", expected: "SE" },
    { input: "godmorgon", expected: "SE" },
    { input: "hello", expected: "EN" },
    { input: "hi there", expected: "EN" },
    { input: "good morning", expected: "EN" },
    { input: "hej med dig", expected: "DA" },
    { input: "godaften", expected: "DA" },
    { input: "hallo", expected: "DE" },
    { input: "guten morgen", expected: "DE" },
  ],
  RELEVANCE: () =>
    [
      "Kan du berätta ett skämt?",
      "Vad är meningen med livet?",
      "Hur bakar man bullar?",
      "Vilken färg har himlen?",
      "Spelar du fotboll?",
      "Vad tycker du om musik?",
      "Hur lång är en orm?",
      "Vad betyder AI?",
      "Har du sett min katt?",
      "Hur mycket väger jorden?",
    ].map((s) => ({ input: s, expected: "FILTER" })),
};

// parse helper
function parseCsv(file, lang, missing) {
  const content = fs.readFileSync(file, "utf8");
  const records = parse(content, { columns: true, skip_empty_lines: true });
  const keyQ = Object.keys(records[0]).find((k) =>
    k.toLowerCase().includes("question")
  );
  const keyA = Object.keys(records[0]).find((k) =>
    k.toLowerCase().includes("answer")
  );
  return records
    .map((r, i) => {
      if (!r[keyA]?.trim()) {
        missing.push(`${path.basename(file)}: rad ${i + 2} saknar svar`);
        return null;
      }
      return { input: r[keyQ].trim(), expected: lang };
    })
    .filter(Boolean);
}

// main
const missing = [];
const data = {};
for (const [lang, file] of Object.entries(csvFiles)) {
  data[lang] = parseCsv(path.join(__dirname, file), lang, missing);
}
Object.assign(data, {
  LONG: tortureGen.LONG(),
  BLOCK: tortureGen.BLOCK(),
  GIBBERISH: tortureGen.GIBBERISH(),
  GREETING: tortureGen.GREETING(),
  RELEVANCE: tortureGen.RELEVANCE(),
});

const jsonFile = path.join(__dirname, "test-cases-full.json");
fs.writeFileSync(jsonFile, "\uFEFF" + JSON.stringify(data, null, 2), "utf8");
fs.writeFileSync(
  path.join(__dirname, "missing-answers.txt"),
  missing.join("\n"),
  "utf8"
);

// zip it
const zipPath = path.join(__dirname, "test-cases-full.zip");
const output = fs.createWriteStream(zipPath);
const archive = archiver("zip", { zlib: { level: 9 } });
archive.pipe(output);
archive.file(jsonFile, { name: "test-cases-full.json" });
archive.file(path.join(__dirname, "missing-answers.txt"), {
  name: "missing-answers.txt",
});
await archive.finalize();

console.log(`✅ test-cases-full.zip klar i ${zipPath}`);
