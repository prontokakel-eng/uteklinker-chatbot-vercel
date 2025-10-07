import * as cheerio from "cheerio";
import fs from "fs";

const BASE_URL = "https://prontokakel.starwebserver.se";
const START_URL = `${BASE_URL}/category/uteklinker`;

// Hjälpfunktion för att hämta HTML med User-Agent
async function fetchHTML(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/123 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml",
    },
  });
  if (!res.ok) throw new Error(`Fel vid hämtning: ${url} (${res.status})`);
  return await res.text();
}

// Hämta alla produktlänkar (med pagination + flera selektorer)
async function getSeriesLinks() {
  const links = new Set();
  let page = 1;

  while (true) {
    const url = page === 1 ? START_URL : `${START_URL}?page=${page}`;
    const html = await fetchHTML(url);
    const $ = cheerio.load(html);

    if (page === 1) {
      console.log("DEBUG HTML START ===");
      console.log($.html().substring(0, 800));
      console.log("=== DEBUG HTML END");
    }

    const before = links.size;

    $('a.product-name, .product a[href^="/product"], .product-list a[href^="/product"]').each(
      (_, el) => {
        const href = $(el).attr("href");
        if (href && href.startsWith("/product")) links.add(BASE_URL + href);
      }
    );

    console.log(
      `DEBUG: page=${page} hittade +${links.size - before} nya länkar (tot=${links.size})`
    );

    const hasNext = $('a[href*="?page="]')
      .toArray()
      .some(
        (a) =>
          Number((a.attribs.href.match(/page=(\d+)/) || [])[1]) > page
      );

    if (!hasNext) break;
    page += 1;
    await new Promise((r) => setTimeout(r, 300));
  }

  return Array.from(links);
}

// Hämta färger och format från en produktsida
async function scrapeProduct(url) {
  const html = await fetchHTML(url);
  const $ = cheerio.load(html);

  const title = $("h1.product-name").text().trim();
  if (!title) throw new Error("Titel saknas");

  const [serieName, ...rest] = title.split(" ");
  const färg = (rest.join(" ") || "Okänd").trim();

  const text = $(".product-description, .product-info, .tabs, .product-short").text();
  const formats = [];
  const regex = /(\d{2,3}(?:\.\d+)?x\d{2,3}(?:\.\d+)?)/gi;
  let match;
  while ((match = regex.exec(text)) !== null) {
    formats.push(match[1].replace(/\s+/g, ""));
  }

  let klass = "Övrigt";
  const f = färg.toLowerCase();
  if (/(cream|beige|sand|mud|taupe)/i.test(f)) klass = "Beige";
  else if (/(light\s*grey|grey|grigio|salt|silver|plomb)/i.test(f)) klass = "Grå";
  else if (/(antracite|anthracite|black|nero)/i.test(f)) klass = "Antracitgrå";
  else if (/(brown|oak|brun|clay|terra|mud)/i.test(f)) klass = "Brun";
  else if (/(white|bianco|vit|leucos)/i.test(f)) klass = "Vit";

  return {
    serie: serieName,
    färg: { namn: färg, klass, format: [...new Set(formats)] },
    url,
  };
}

// Huvudkörning
(async () => {
  const series = await getSeriesLinks();
  console.log(`Hittade ${series.length} produkter/serier…`);

  const data = {};
  for (const url of series) {
    try {
      const info = await scrapeProduct(url);
      if (!data[info.serie]) data[info.serie] = { färger: [] };
      data[info.serie].färger.push(info.färg);
    } catch (err) {
      console.error("Fel vid skrapning:", url, err.message);
    }
  }

  fs.writeFileSync("pronto-farger.json", JSON.stringify(data, null, 2), "utf-8");
  console.log("✅ Klart! Data sparad i pronto-farger.json");
})();
