// /tests/clean-faq-samples.mjs
import { google } from "googleapis";
import "../lib/load-env.js";

const clientEmail = process.env.GCP_CLIENT_EMAIL;
const privateKey = process.env.GCP_PRIVATE_KEY?.replace(/\\n/g, "\n");
const folderId = process.env.FAQ_DRIVE_FOLDER_ID;

if (!clientEmail || !privateKey || !folderId) {
  console.error("❌ Missing GCP_CLIENT_EMAIL, GCP_PRIVATE_KEY or FAQ_DRIVE_FOLDER_ID in env.local");
  process.exit(1);
}

console.log("🔑 Kör med servicekonto:", clientEmail);

const auth = new google.auth.JWT({
  email: clientEmail,
  key: privateKey,
  scopes: ["https://www.googleapis.com/auth/drive"],
});

const drive = google.drive({ version: "v3", auth });

async function cleanFaqSamples() {
  try {
    // 1️⃣ Lista filer i mappen
    const res = await drive.files.list({
      q: `'${folderId}' in parents and mimeType='application/vnd.google-apps.spreadsheet'`,
      fields: "files(id, name)",
    });

    const files = res.data.files || [];
    console.log(`📂 Hittade ${files.length} filer i FAQ-mappen`);

    // 2️⃣ Filtrera på testfiler
    const testFiles = files.filter((f) => f.name.startsWith("FAQ_GENERATED_SAMPLE_"));

    if (testFiles.length === 0) {
      console.log("ℹ️ Inga testark att rensa.");
      return;
    }

    console.log(`🗑 Kommer ta bort ${testFiles.length} testark:\n`);
    testFiles.forEach((f) => console.log(`   - ${f.name} (${f.id})`));

    // 3️⃣ Radera filer
    for (const f of testFiles) {
      await drive.files.delete({ fileId: f.id });
      console.log(`   ✅ Deleted: ${f.name}`);
    }

    console.log("🎉 Rensning klar!");
  } catch (err) {
    console.error("❌ Error cleaning FAQ samples:", err.message);
  }
}

cleanFaqSamples();
