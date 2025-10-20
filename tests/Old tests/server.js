import "../lib/load-env.js";
import express from "express";
import bodyParser from "body-parser";
import path from "path";
import { fileURLToPath } from "url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
// Serva statiska filer (frontend)
app.use("/css", express.static(path.join(__dirname, "css")));
app.use("/js", express.static(path.join(__dirname, "js")));
app.use(express.static(__dirname)); // index.html i roten
// Healthcheck
app.get("/healthz", (_, res) => res.status(200).json({ ok: true }));
// Root
app.get("/", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});
// 🚀 Starta endast lokalt
if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`🚀 Lokal dev-server körs på http://localhost:${PORT}`);
  });
}
export default app;
