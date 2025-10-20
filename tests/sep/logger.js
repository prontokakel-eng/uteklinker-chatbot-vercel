import fs from "fs";
import path from "path";

const logFile = path.join(process.cwd(), "logs", "dev-chat.log");

// säkerställ att katalogen finns
if (!fs.existsSync(path.dirname(logFile))) {
  fs.mkdirSync(path.dirname(logFile), { recursive: true });
}

export function logDebug(message, obj = null) {
  const line = `[${new Date().toISOString()}] ${message}` +
               (obj ? ` ${JSON.stringify(obj, null, 2)}` : "");
  fs.appendFileSync(logFile, line + "\n", "utf8");
  console.log(line); // skriv även till console
}
