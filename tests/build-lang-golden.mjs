// tests/build-lang-golden.mjs
// ESM-script som:
// 1) Läser alla CSV-filer i tests/data/lang-golden/*.csv (dina flikar)
// 2) Fixar teckenkodning (UTF-8 vs Windows-1252) automatiskt
// 3) Plockar ut textfält från FAQ_* (kolumn question_xx) och *_FULL_LOOKUP (en kolumn utan header)
// 4) Mappar filnamn → språkkod (sv|en|da|de)
// 5) Skriver sammanlagd tests/data/lang-golden.csv med header "text,lang"
// OBS: Ingen ändring av projektets befintliga logik.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import iconv from "iconv-lite";
import { parse } from "csv-parse/sync";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SRC_DIR = path.join(__dirname, "data", "lang-golden");
const OUT_FILE = path.join(SRC_DIR, "..", "lang-golden.csv"); // tests/data/lang-golden.csv

// Filnamn → språk
function langFromFilename(name) {
  const n = name.toLowerCase();
  if (n.includes("faq_se") || n.includes("se_full_lookup")) return "sv";
  if (n.includes("faq_en") || n.includes("en_full_lookup")) return "en";
  if (n.includes("faq_da") || n.includes("da_full_lookup")) return "da";
  if (n.includes("faq_de") || n.includes("de_full_lookup")) return "de";
  // fallback: titta på ledande "SE/EN/DA/DE" i första cell
  return null;
}

// Heuristik: har strängen mojibake-tecken?
function seemsMojibake(s) {
  return /Ã.|Â./.test(s); // fångar t.ex. "KÃ¤lla", "FÃ¶ljande"
}

// Läs fil med robust decoding
function readCsvText(full) {
  const buf = fs.readFileSync(full);
  let str = buf.toString("utf8");
  // Om det ser fel ut, prova Windows-1252
  if (seemsMojibake(str)) {
    str = iconv.decode(buf, "win1252");
  }
  // Normalisera radbrytningar
  return str.replace(/\r\n/g, "\n");
}

// Parse CSV till records
function parseCsv(str) {
  // Tillåt ofullständiga rader & citattecken
  return parse(str, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    relax_quotes: true,
    trim: true,
  });
}

// Enkel CSV utan header (en kolumn per rad)
function parseSingleColumnCsv(str) {
  const lines = str.split("\n").map((l) => l.trim()).filter(Boolean);
  // Filtrera bort ev. språkkod som första rad (SE|EN|DA|DE)
  const first = (lines[0] || "").toUpperCase();
  const startIdx = ["SE", "EN", "DA", "DE"].includes(first) ? 1 : 0;
  return lines.slice(startIdx);
}

// Välj texter ur en parsed CSV med header
function extractTextsWithHeader(recs, filename) {
  // För FAQ_* letar vi efter kolumner: question_se|question_en|question_da|question_de
  const lowerCols = recs.length ? Object.keys(recs[0]).map((c) => c.toLowerCase()) : [];
  const langColMap = {
    sv: "question_se",
    en: "question_en",
    da: "question_da",
    de: "question_de",
  };
  const lang = langFromFilename(filename);
  let targetCol = lang ? langColMap[lang] : null;

  // Om ingen explicit, försök hitta första kolumn som börjar med "question_"
  if (!targetCol) {
    targetCol = lowerCols.find((c) => c.startsWith("question_")) || null;
  }

  // Om fortfarande inget, försök heuristik: första kolumnen som inte ser ut som "answer_*" eller källa
  if (!targetCol && lowerCols.length) {
    targetCol = lowerCols.find((c) => !c.startsWith("answer_") && !c.includes("kalla") && !c.includes("källa")) || lowerCols[0];
  }

  // Extrahera
  const out = [];
  for (const r of recs) {
    const keys = Object.keys(r);
    let val = null;
    if (targetCol && (targetCol in r || keys.map(k => k.toLowerCase()).includes(targetCol))) {
      // Hitta originalnyckel-fallet (case-sensitive)
      const realKey = keys.find((k) => k.toLowerCase() === targetCol);
      val = r[realKey];
    } else {
      // som sista utväg: ta första kolumnen
      val = r[keys[0]];
    }
    if (typeof val === "string") {
      out.push(val);
    }
  }
  return out;
}

function cleanText(s) {
  // Trim + normalisera whitespace + behåll punktlistor och siffror
  let t = s.replace(/\s+/g, " ").trim();
  // Ta bort om det mest är skräp/URL/ren symbolrad
  if (t.length < 2) return "";
  return t;
}

function unique(arr) {
  const seen = new Set();
  const out = [];
  for (const x of arr) {
    const k = x.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      out.push(x);
    }
  }
  return out;
}

function inferLangFromFirstCell(str) {
  const firstLine = str.split("\n").map((l) => l.trim()).find(Boolean) || "";
  const up = firstLine.toUpperCase();
  if (["SE", "SV"].includes(up)) return "sv";
  if (up === "EN") return "en";
  if (up === "DA") return "da";
  if (up === "DE") return "de";
  return null;
}

function main() {
  if (!fs.existsSync(SRC_DIR)) {
    console.error(`Hittade inte mappen: ${SRC_DIR}`);
    process.exit(1);
  }
  const files = fs.readdirSync(SRC_DIR).filter((f) => f.toLowerCase().endsWith(".csv"));
  if (!files.length) {
    console.error("Inga CSV-filer hittades i tests/data/lang-golden/");
    process.exit(1);
  }

  /** @type {{text:string, lang:"sv"|"en"|"da"|"de"}[]} */
  const rows = [];
  const stats = { sv: 0, en: 0, da: 0, de: 0 };

  for (const name of files) {
    const full = path.join(SRC_DIR, name);
    const raw = readCsvText(full);

    // Försök avgöra typ
    const hasCommaInHeader = raw.split("\n")[0]?.includes(",");
    const isFaq = /faq_/i.test(name);
    const isLookup = /full_lookup/i.test(name);

    // Bestäm språk
    let lang = langFromFilename(name) || inferLangFromFirstCell(raw);
    if (!lang) {
      // sista utväg: gissa på filnamnets suffix
      if (/[_-]se/i.test(name)) lang = "sv";
      else if (/[_-]en/i.test(name)) lang = "en";
      else if (/[_-]da/i.test(name)) lang = "da";
      else if (/[_-]de/i.test(name)) lang = "de";
    }
    if (!lang) {
      console.warn(`(Hoppar) Kunde inte avgöra språk för: ${name}`);
      continue;
    }

    let texts = [];
    try {
      if (isFaq || hasCommaInHeader) {
        const recs = parseCsv(raw);
        texts = extractTextsWithHeader(recs, name);
      } else if (isLookup || !hasCommaInHeader) {
        texts = parseSingleColumnCsv(raw);
      }
    } catch (e) {
      console.warn(`(Hoppar) Parse-fel i ${name}: ${e.message}`);
      continue;
    }

    // Städa & filtrera
    texts = texts
      .map(cleanText)
      .filter(Boolean)
      // valfri enkel filtrering: ta bort rader som är "för korta" och rena siffror
      .filter((t) => t.length >= 2);

    for (const t of texts) {
      rows.push({ text: t, lang });
      stats[lang]++;
    }
  }

  // Dedupera bevarat i ordning
  const deduped = unique(rows.map((r) => `${r.text}|||${r.lang}`)).map((s) => {
    const [text, lang] = s.split("|||");
    return { text, lang };
  });

  // Skriv utdata
  const header = "text,lang\n";
  const body = deduped.map((r) => {
    // Escapa citattecken och kommatecken korrekt
    const escaped = r.text.includes(",") || r.text.includes('"') ? `"${r.text.replace(/"/g, '""')}"` : r.text;
    return `${escaped},${r.lang}`;
  }).join("\n");

  fs.writeFileSync(OUT_FILE, header + body + "\n", "utf8");

  console.log("✅ Byggt tests/data/lang-golden.csv");
  console.log(`   Rader in: sv=${stats.sv}, en=${stats.en}, da=${stats.da}, de=${stats.de}`);
  console.log(`   Rader ut (unika): ${deduped.length}`);
  console.log(`   Fil: ${OUT_FILE}`);
}

main();
