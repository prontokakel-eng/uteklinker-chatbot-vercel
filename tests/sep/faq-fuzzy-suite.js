import "../lib/load-env.js";
 1 // /tests/faq-fuzzy-suite.js
 2 
 3 import fs from "fs";
 4 import path from "path";
 5 import { fileURLToPath } from "url";
 6 import { google } from "googleapis";
 7 import stringSimilarity from "string-similarity";
 8 
 9 import { getFaqByLang, getFaqCache } from "./../lib/faq-cache.js";
10 import { normalizeMessage } from "./../lib/utils.js";
11 import { detectLangLocal } from "./../lib/detect-lang.js";
12 
13 dotenv.config({ path: "../.env.vercel" });
14 
15 // --- Loggfunktion ---
16 const __filename = fileURLToPath(import.meta.url);
17 const __dirname = path.dirname(__filename);
18 
19 const LOG_DIR = path.join(__dirname, "../logs");
20 const LOG_FILE = path.join(LOG_DIR, "dev-chat.log");
21 
22 if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });
23 
24 let mismatchCount = 0; // ✅ global räknare
25 
26 function logChat(message, expectedLang, source, reply) {
27   const detected = detectLangLocal(message);
28   const line =
29     `[${new Date().toISOString()}] (expected=${expectedLang}, detected=${detected.lang}/${detected.method}, source=${source})\n` +
30     `Q: ${message}\n→ ${reply}\n\n`;
31 
32   fs.appendFileSync(LOG_FILE, line, "utf8");
33 
34   if (expectedLang !== detected.lang) {
35     mismatchCount++; // ✅ öka räknaren
36     console.warn(
37       `⚠️ Språk-mismatch: expected=${expectedLang}, detected=${detected.lang} (${detected.method}) for Q="${message}"`
38     );
39   }
40 }
41 
42 function ok(msg) { console.log("✅", msg); }
43 function fail(msg) { console.error("❌", msg); process.exitCode = 1; }
44 
45 // --- Google Sheets helpers ---
46 function getAuth() {
47   return new google.auth.GoogleAuth({
48     credentials: {
49       type: "service_account",
50       project_id: process.env.GCP_PROJECT_ID,
51       private_key_id: process.env.GCP_PRIVATE_KEY_ID,
52       private_key: process.env.GCP_PRIVATE_KEY?.replace(/\\n/g, "\n"),
53       client_email: process.env.GCP_CLIENT_EMAIL,
54       client_id: process.env.GCP_CLIENT_ID,
55       sheet_id: process.env.SHEET_ID,
56     },
57     scopes: ["https://www.googleapis.com/auth/spreadsheets"],
58   });
59 }
60 async function getSheets() {
61   const auth = await getAuth();
62   return google.sheets({ version: "v4", auth });
63 }
64 
65 const SHEET_ID = process.env.SHEET_ID;
66 const TEST_TAB = "Test";
67 const LANGS = ["SE", "EN", "DA", "DE"];
68 
69 function pickNPerLang(FAQ_CACHE, n = 4) {
70   const items = [];
71   for (const lang of LANGS) {
72     const list = FAQ_CACHE[lang] || [];
73     console.log(`🔎 pickNPerLang: ${lang} -> ${list.length} frågor i cache`);
74     if (!list || list.length < n) throw new Error(`För få rader i FAQ_${lang}`);
75     for (let i = 0; i < n; i++) {
76       const row = list[i];
77       items.push({ lang, question: String(row.question || ""), answer: String(row.answer || "") });
78     }
79   }
80   return items;
81 }
82 
83 async function appendRowsToTest(rows) {
84   if (!rows.length) return;
85   console.log("📝 APPEND →", rows.length, "rader till Test!A:B");
86   const sheets = await getSheets();
87   await sheets.spreadsheets.values.append({
88     spreadsheetId: SHEET_ID,
89     range: `${TEST_TAB}!A:B`,
90     valueInputOption: "RAW",
91     requestBody: { values: rows },
92   });
93 }
94 
95 async function runExactSuite() {
96   const FAQ_CACHE = await getFaqCache(true);
97   console.log("📚 FAQ laddad i runExactSuite");
98 
99   for (const lang of LANGS) {
100     if (!FAQ_CACHE[lang] || FAQ_CACHE[lang].length === 0) {
101       fail(`Cache saknar data för språk: ${lang}`);
102     } else {
103       console.log(`✅ Cache innehåller ${FAQ_CACHE[lang].length} frågor för ${lang}`);
104     }
105   }
106 
107   const items = pickNPerLang(FAQ_CACHE, 4);
108   ok(`Valde ${items.length} frågor (${LANGS.join(", ")})`);
109 
110   const rows = [];
111 
112   for (const it of items) {
113     const normQ = normalizeMessage(it.question);
114     const questions = (await getFaqByLang(it.lang)).map(f => normalizeMessage(f.question));
115     const matches = stringSimilarity.findBestMatch(normQ, questions);
116 
117     if (normQ !== questions[matches.bestMatchIndex]) {
118       fail(`Ingen exakt match för ${it.lang} :: ${it.question}`);
119     } else {
120       const reply = (await getFaqByLang(it.lang))[matches.bestMatchIndex].answer;
121       logChat(it.question, it.lang, "FAQ", reply);
122       rows.push([it.question, reply]);
123     }
124   }
125 
126   await appendRowsToTest(rows);
127   ok("Alla exakta frågor matchade sina svar och skrevs till Sheets");
128 }
129 
130 async function runFuzzySuite() {
131   const FAQ_CACHE = await getFaqCache(true);
132   console.log("📚 FAQ laddad i runFuzzySuite");
133 
134   for (const lang of LANGS) {
135     if (!FAQ_CACHE[lang] || FAQ_CACHE[lang].length === 0) {
136       fail(`Cache saknar data för språk: ${lang}`);
137     } else {
138       console.log(`✅ Cache innehåller ${FAQ_CACHE[lang].length} frågor för ${lang}`);
139     }
140   }
141 
142   const items = pickNPerLang(FAQ_CACHE, 4);
143   const rows = [];
144 
145   for (const it of items) {
146     const questions = (await getFaqByLang(it.lang)).map(f => f.question);
147     const matches = stringSimilarity.findBestMatch(normalizeMessage(it.question), questions);
148     const reply = (await getFaqByLang(it.lang))[matches.bestMatchIndex].answer;
149 
150     logChat(it.question, it.lang, "FUZZY", reply);
151     rows.push([it.question, reply]);
152   }
153 
154   await appendRowsToTest(rows);
155   ok("FUZZY-match loggad och skriven till Sheets");
156 }
157 
158 async function main() {
159   const mode = (process.argv[2] || "both").toLowerCase();
160   if (!SHEET_ID) throw new Error("SHEET_ID saknas i .env.vercel");
161 
162   if (mode === "exact" || mode === "both") await runExactSuite();
163   if (mode === "fuzzy" || mode === "both") await runFuzzySuite();
164 
165   console.log("🟩 Alla tester klara");
166   console.log(`📊 Summering: ${mismatchCount} språk-mismatchar hittades`); // ✅ summering
167 }
168 
169 main().catch(err => {
170   console.error("💥 Testfel:", err);
171   process.exit(1);
172 });
