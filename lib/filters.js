import { logMessage } from "./logger.js";

/* ============================================================
   Hjälpare för normalisering och fuzzy-match
   ============================================================ */

// Tar bort diakritik (å/ä/ö -> a/ä/o -> a/a/o) och normaliserar
function stripDiacritics(s) {
  return String(s || "").normalize("NFKD").replace(/\p{M}+/gu, "");
}

// Sänker till gemener, tar bort icke-bokstavliga tecken, normaliserar whitespace
function normalizeText(s) {
  return stripDiacritics(String(s || "").toLowerCase())
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(s) {
  return normalizeText(s).split(" ").filter(Boolean);
}

// Damerau–Levenshtein light med tidigt avbrott vid max-avstånd
function editDistanceMax(a, b, max = 1) {
  if (a === b) return 0;
  const la = a.length, lb = b.length;
  if (Math.abs(la - lb) > max) return max + 1;

  const dp = Array.from({ length: la + 1 }, (_, i) => {
    const row = new Array(lb + 1);
    row[0] = i;
    return row;
  });
  for (let j = 0; j <= lb; j++) dp[0][j] = j;

  for (let i = 1; i <= la; i++) {
    let rowMin = (dp[i][0] = i);
    for (let j = 1; j <= lb; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1, // del
        dp[i][j - 1] + 1, // ins
        dp[i - 1][j - 1] + cost // sub
      );
      // transposition
      if (
        i > 1 &&
        j > 1 &&
        a[i - 1] === b[j - 2] &&
        a[i - 2] === b[j - 1]
      ) {
        dp[i][j] = Math.min(dp[i][j], dp[i - 2][j - 2] + 1);
      }
      if (dp[i][j] < rowMin) rowMin = dp[i][j];
    }
    if (rowMin > max) return max + 1; // early stop
  }
  return dp[la][lb];
}

function fuzzyHasToken(textTokens, word, max = 1) {
  const w = normalizeText(word);
  for (const t of textTokens) {
    if (t === w) return true;
    if (editDistanceMax(t, w, max) <= max) return true;
  }
  return false;
}

function fuzzyHasAll(textTokens, words, max = 1) {
  return words.every((w) => fuzzyHasToken(textTokens, w, max));
}

/* ============================================================
   🧩 Kortord-detektion (existerar redan i Gate)
   ============================================================ */
export function detectShortLangWord(text = "") {
  const t = text.trim().toLowerCase();
  const shortLex = {
    SE: ["ja", "nej", "hej", "tack"],
    DA: ["ja", "nej", "tak", "hej"],
    DE: ["ja", "nein", "danke", "hallo"],
    EN: ["hi", "ok", "no", "yes", "hey"],
  };

  for (const [lang, list] of Object.entries(shortLex)) {
    if (list.includes(t)) {
      return {
        handled: true,
        lang,
        via: "shortword-filter",
        confidence: 0.9,
      };
    }
  }
  return { handled: false };
}

/* ============================================================
   🧩 checkGreeting – robust fuzzy-detektion (SE/EN/DA/DE)
   ============================================================ */

// Diakritikfria nycklar – normalizeText tar redan bort å/ä/ö etc.
const GREET_LEX = {
  SE: {
    greet: ["hej", "hejsan", "hallå", "tja", "tjena", "god morgon", "god kväll", "goddag"],
    howareyou: [
      ["hur", "mar", "du"], // mår du
      ["mar", "du", "bra"], // mår du bra
      ["lage"], // läge / läget
      ["laget"],
    ],
  },
  EN: {
    greet: ["hi", "hello", "hey", "good morning", "good evening", "good afternoon"],
    howareyou: [["how", "are", "you"]],
  },
  DA: {
    greet: ["hej", "hallo", "dav", "godmorgen", "godaften"],
    howareyou: [["hvordan", "har", "du", "det"]],
  },
  DE: {
    greet: ["hallo", "guten morgen", "guten abend", "servus", "moin", "guten tag"],
    howareyou: [["wie", "geht", "es", "dir"], ["wie", "gehts"]],
  },
};

export function checkGreeting(text = "", /* defaultLang = 'SE' */) {
  if (!text || typeof text !== "string") return { handled: false };

  const norm = normalizeText(text);
  const tokens = tokenize(norm);

  // Väldigt kort? Låt kortordslogiken ta det
  if (tokens.length === 1 && tokens[0].length <= 2) return { handled: false };

  // Scora språk efter träffar
  const scores = [];
  for (const [lang, def] of Object.entries(GREET_LEX)) {
    let score = 0;

    // Hälsningsfraser (fuzzy)
    for (const phrase of def.greet) {
      const words = phrase.split(" ");
      if (fuzzyHasAll(tokens, words, 1)) score += 1;
    }
    // “Hur mår du?”-mönster (fuzzy, lite tyngre)
    for (const words of def.howareyou) {
      if (fuzzyHasAll(tokens, words, 1)) score += 2;
    }

    if (score > 0) scores.push({ lang, score });
  }

  if (scores.length === 0) return { handled: false };

  scores.sort((a, b) => b.score - a.score);
  const top = scores[0];

  logMessage("filters.log", `👋 Greeting detected: ${text}`);
  return {
    handled: true,
    type: "greeting",
    reason: "greeting",
    via: "greeting-fuzzy",
    lang: top.lang, // <-- viktigt för Gate/test
  };
}

/* ============================================================
   🧩 runFilters – centralt filter-anrop (punkt 4–6 i Gate-kontraktet)
   ============================================================ */
export function runFilters(input, defaultLang = "SE") {
  const text = (input || "").trim();
  if (!text) return { handled: false };

  // 1️⃣ Kortord (ja/nej/hej/tack m.m.)
  const shortRes = detectShortLangWord(text);
  if (shortRes.handled) {
    logMessage("filters.log", `✅ Kortord hanterat (${text})`);
    const replies = {
      SE: shortRes.reply || text,
      DA: shortRes.reply || text,
      DE: shortRes.reply || text,
      EN: shortRes.reply || text,
    };
    // Lägg med lang så Gate kan ta språkbeslut direkt
    return {
      handled: true,
      type: "shortword",
      reply: replies[shortRes.lang || defaultLang],
      lang: shortRes.lang || defaultLang,
      via: shortRes.via || "shortword-filter",
    };
  }

  // 2️⃣ Hälsning (hej/hello m.m.) – fuzzy & språkavgörande
  const greetRes = checkGreeting(text, defaultLang);
  if (greetRes.handled) {
    const langForReply = greetRes.lang || defaultLang;
    const replies = {
      SE: "Hej!",
      DA: "Hej!",
      DE: "Hallo!",
      EN: "Hello!",
    };
    logMessage("filters.log", `👋 Hälsning hanterad (${text})`);
    return {
      handled: true,
      type: "greeting",
      reply: replies[langForReply],
      lang: langForReply, // <-- viktigt för Gate/test
      via: greetRes.via || "greeting-filter",
    };
  }

  // 3️⃣ För kort eller nonsens (behåll befintligt beteende)
  if (text.length < 3 || /^(en|sa|ok|no|yo)$/i.test(text)) {
    logMessage("filters.log", `⚠️ Otydlig eller för kort input: "${text}"`);
    const replies = {
      SE: "Vänligen skriv en mer specifik fråga så jag kan hjälpa dig.",
      DA: "Venligst skriv et mere specifikt spørgsmål, så jeg kan hjælpe dig.",
      DE: "Bitte formulieren Sie Ihre Frage genauer, damit ich Ihnen helfen kann.",
      EN: "Please write a more specific question so I can assist you.",
    };
    return { handled: true, type: "invalid", reply: replies[defaultLang] };
  }

  // 4️⃣ Annars passera vidare
  return { handled: false };
}
