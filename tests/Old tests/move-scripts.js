// move-scripts.js
// Flyttar .js-filer mellan projektroten och /js/
// Kör med: node move-scripts.js forward   -> flytta till /js
// Kör med: node move-scripts.js backward  -> flytta tillbaka till roten

const fs = require("fs");
const path = require("path");

const rootDir = __dirname;
const jsDir = path.join(rootDir, "js");

// vilka filer som ska flyttas
const files = ["chat-ui.js", "app.js", "api.js"];

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
  console.log("Använd: node move-scripts.js forward | backward");
}
