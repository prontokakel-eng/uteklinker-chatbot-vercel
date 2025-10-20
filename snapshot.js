// snapshot.js (ESM-version)
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = __dirname;
const outputFile = path.join(rootDir, "snapshot.json");

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);

  list.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    if (stat && stat.isDirectory()) {
      results.push({
        type: "dir",
        name: file,
        path: path.relative(rootDir, filePath),
      });
      results = results.concat(walk(filePath));
    } else {
      results.push({
        type: "file",
        name: file,
        path: path.relative(rootDir, filePath),
        size: stat.size,
        mtime: stat.mtime,
      });
    }
  });

  return results;
}

const snapshot = walk(rootDir);
fs.writeFileSync(outputFile, JSON.stringify(snapshot, null, 2), "utf8");
console.log(`✅ Snapshot sparad till ${outputFile}`);
