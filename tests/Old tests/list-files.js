// list-files.js
import fs from "fs";
import path from "path";

const rootDir = "C:/uteklinker-chatbot-vercel";
const outFile = "project-structure.txt";

function listDir(dir, indent = "") {
  const items = fs.readdirSync(dir, { withFileTypes: true });
  let output = "";
  for (const item of items) {
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      output += `${indent}📂 ${item.name}/\n`;
      output += listDir(fullPath, indent + "   ");
    } else {
      output += `${indent}📄 ${item.name}\n`;
    }
  }
  return output;
}

const header = `Innehåll i: ${rootDir}\n\n`;
const content = listDir(rootDir);

fs.writeFileSync(outFile, header + content, "utf8");
console.log(`✅ Struktur sparad i ${outFile}`);
