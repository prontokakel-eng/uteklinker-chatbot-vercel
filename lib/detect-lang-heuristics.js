// 🧩 PATCHED: detect-lang-heuristics.js
// Språkgruppering och teckenfrekvensanalys (Regex → Heuristik → IP → AI)
// Förbättrad blandtextdetektion ("Hej, how are you?" → EN)

export function detectLangHeuristicGroup(input) {
  if (!input || typeof input !== "string") {
    return { lang: "UNKNOWN", via: "heuristic-group", confidence: 0.0 };
  }

  const txt = input.toLowerCase();

  // Poängsätt språk efter teckenfrekvens och vanliga token
  let score = { SE: 0, DA: 0, DE: 0, EN: 0 };

  // Svenska tecken
  if (/[åäö]/.test(txt)) score.SE += 0.4;

  // Danska tecken
  if (/[æø]/.test(txt)) score.DA += 0.4;

  // Tyska tecken
  if (/[üöß]/.test(txt)) score.DE += 0.4;

  // Engelska mönster
  if (/( th|the |and |you |your |not |will )/.test(txt)) score.EN += 0.4;

  // Ytterligare ordförekomster (lågfrekventa markörer)
  const seWords = ["varför", "eftersom", "inte", "och", "hej"];
  const daWords = ["hvorfor", "fordi", "ikke", "og", "hej"];
  const deWords = ["warum", "nicht", "und", "aber"];
  const enWords = ["why", "because", "not", "and", "how", "are", "you", "what", "can", "will"];

  for (const w of seWords) if (txt.includes(w)) score.SE += 0.2;
  for (const w of daWords) if (txt.includes(w)) score.DA += 0.2;
  for (const w of deWords) if (txt.includes(w)) score.DE += 0.2;
  for (const w of enWords) if (txt.includes(w)) score.EN += 0.2;

  // 🧩 PATCH: Hantera blandad text (t.ex. "Hej, how are you?")
  const englishTokens = (txt.match(/\b(?:the|how|are|you|what|can|will|not)\b/g) || []).length;
  const swedishTokens = (txt.match(/\b(?:hej|och|inte|varför|eftersom)\b/g) || []).length;

  if (englishTokens > 1 && englishTokens > swedishTokens) {
    score.EN += 0.4; // boost EN om den dominerar
    score.SE -= 0.2; // minska SE-vikt vid blandning
  }

  // Bestäm bästa språk
  const sorted = Object.entries(score).sort((a, b) => b[1] - a[1]);
  const [topLang, topScore] = sorted[0];

  const confidence =
    topScore >= 0.7 ? topScore :
    topScore >= 0.5 ? 0.6 :
    topScore > 0.3 ? 0.5 : 0.4;

  return { lang: topLang, via: "heuristic-group", confidence };
}
