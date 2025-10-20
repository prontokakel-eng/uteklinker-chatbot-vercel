// tests/test-faq-search.mjs
import { getFaqCounts } from "../lib/faq-cache-view.js";
import { searchFaq } from "../lib/faq-search.js";

console.log("Counts:", await getFaqCounts());

const cases = [
  { q: "färg på plattor", lang: "SE" },
  { q: "färg på plattor", lang: "EN" }, // should fallback to SE
  { q: "kørsel med bil", lang: "DA" },  // example Danish diacritics
];

for (const c of cases) {
  const res = await searchFaq(c.q, { lang: c.lang, limit: 5 });
  console.log(`\nQuery="${c.q}" lang=${c.lang} → hits=${res.length}`);
  for (const r of res) {
    const q = r.item?.question ?? "<no question>";
    console.log(" -", q, "(score:", r.score?.toFixed(3), ")");
  }
}
