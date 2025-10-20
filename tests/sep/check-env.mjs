import "../lib/load-env.js";
import path from "path";
dotenv.config({ path: path.resolve("../.env.vercel") });
console.log("SHEET_ID =", process.env.SHEET_ID);
