// lib/logger.js
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
  const line = `[${timestamp}] ${message}`;

  if (isVercel()) {
    // 🚀 På Vercel loggar vi bara till console
    console.log(`[${file}] ${line}`);
  } else {
    // 🖥️ Lokalt skriver vi även till fil
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    const logFile = path.join(logDir, file);
    fs.appendFileSync(file, line, { encoding: "utf8" });
    console.log(`[${file}] ${line}`);
  }
}
