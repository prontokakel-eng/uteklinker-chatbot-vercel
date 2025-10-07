// move-core-scripts.js
// Flytta app.js och api.js mellan roten och /js/
// Kör: node move-core-scripts.js forward   -> flytta till /js
// Kör: node move-core-scripts.js backward  -> flytta tillbaka

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootDir = __dirname;
const jsDir = path.join(rootDir, "js");

// Vilka filer ska flyttas
const files = ["app.js", "api.js"];

function moveFile(file, fromDir, toDir) {
  const fromPath = path.join(fromDir, file);
  const toPath = path.join(toDir, file);

  if (!fs.existsSync(fromPath)) {
    console.warn(`⚠️  Fil saknas: ${fromPath}`);
    return;
  }

  if (!fs.existsSync(toDir)) {
    fs.mkdirSync(toDir, { recursive: true });
  }

  fs.renameSync(fromPath, toPath);
  console.log(`✅ Flyttade ${file} → ${toDir}`);
}

const direction = process.argv[2];

if (direction === "forward") {
  console.log("🚀 Flyttar filer till /js...");
  files.forEach(f => moveFile(f, rootDir, jsDir));
} else if (direction === "backward") {
  console.log("↩️ Flyttar filer tillbaka till roten...");
  files.forEach(f => moveFile(f, jsDir, rootDir));
} else {
  console.log("Använd: node move-core-scripts.js forward | backward");
}
