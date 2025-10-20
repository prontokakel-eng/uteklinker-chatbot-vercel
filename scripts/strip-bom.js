import fs from "node:fs";

const p = "./lib/load-env.js";
let buf = fs.readFileSync(p);

// 1) Ta bort BOM om den finns
if (buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
  buf = buf.slice(3);
}

// 2) Normalisera radbrytningar (Windows → Unix)
let text = buf.toString("utf8").replace(/\r\n/g, "\n");

// 3) Skriv tillbaka i UTF-8 utan BOM
fs.writeFileSync(p, text, { encoding: "utf8" });

console.log("✅ Stripped BOM and normalized EOL for", p);
