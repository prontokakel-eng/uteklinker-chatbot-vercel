// lib/logger.js (patchad v6.3.3 – asynkron & icke-blockerande)
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// 🔧 Hitta rätt filväg oavsett varifrån scriptet körs
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Logs hamnar alltid i projektroten under /logs
const logDir = path.join(__dirname, "..", "logs");

function isVercel() {
  return process.env.VERCEL === "1" || process.env.VERCEL_ENV !== undefined;
}

export function logMessage(file, message) {
  const timestamp = new Date().toISOString();
  const line = `[${timestamp}] ${message}\n`;

  if (isVercel()) {
    // 🚀 På Vercel loggar vi bara till console
    console.log(`[${file}] ${line.trimEnd()}`);
  } else {
    try {
      // 🖥️ Lokalt skriver vi även till fil (icke-blockerande)
      if (!fs.existsSync(logDir)) {
        fs.mkdirSync(logDir, { recursive: true });
      }
      const logFile = path.join(logDir, file);
      fs.appendFile(logFile, line, { encoding: "utf8" }, (err) => {
        if (err) console.error(`Log append error in ${file}:`, err.message);
      });
      console.log(`[${file}] ${line.trimEnd()}`);
    } catch (err) {
      console.error(`Logger error for ${file}:`, err.message);
    }
  }
}