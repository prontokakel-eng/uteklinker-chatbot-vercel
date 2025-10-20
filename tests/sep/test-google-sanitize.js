// tests/test-google-sanitize.js
import { google } from "googleapis";

// enkel sanerings-funktion (samma som i utils.js)
const clean = (v) => (v || "").replace(/^"|"$/g, "").trim();

function showVar(name, value, maxLen = 80) {
  if (!value) {
    console.warn(`⚠️ ${name} saknas!`);
    return;
  }
  const cleaned = clean(value).replace(/\\n/g, "\n");
  console.log(`\n🔍 ${name}`);
  console.log("Raw start:", value.substring(0, maxLen));
  console.log("Raw end  :", value.substring(value.length - maxLen));
  console.log("Cleaned start:", cleaned.substring(0, maxLen));
  console.log("Cleaned end  :", cleaned.substring(cleaned.length - maxLen));
}

try {
  console.log("=== GCP ENV SANITIZE TEST ===");

  showVar("GCP_PROJECT_ID", process.env.GCP_PROJECT_ID);
  showVar("GCP_PRIVATE_KEY_ID", process.env.GCP_PRIVATE_KEY_ID);
  showVar("GCP_CLIENT_EMAIL", process.env.GCP_CLIENT_EMAIL);
  showVar("GCP_CLIENT_ID", process.env.GCP_CLIENT_ID);

  const pk = process.env.GCP_PRIVATE_KEY;
  if (!pk) {
    console.error("❌ GCP_PRIVATE_KEY saknas helt!");
  } else {
    console.log("\n🔑 GCP_PRIVATE_KEY length:", pk.length);
    console.log("Starts with:", pk.substring(0, 40));
    console.log("Ends with:", pk.substring(pk.length - 40));
    console.log("Contains \\n ?", pk.includes("\\n"));
  }

  // Försök skapa GoogleAuth för att se om den accepterar nyckeln
  const auth = new google.auth.GoogleAuth({
    credentials: {
      type: "service_account",
      project_id: clean(process.env.GCP_PROJECT_ID),
      private_key_id: clean(process.env.GCP_PRIVATE_KEY_ID),
      private_key: (process.env.GCP_PRIVATE_KEY || "")
        .replace(/\\n/g, "\n")
        .replace(/^"|"$/g, "")
        .trim(),
      client_email: clean(process.env.GCP_CLIENT_EMAIL),
      client_id: clean(process.env.GCP_CLIENT_ID),
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });

  await auth.getClient();
  console.log("\n✅ GoogleAuth klient skapad utan fel!");
} catch (err) {
  console.error("\n❌ GoogleAuth error:", err.message);
}
