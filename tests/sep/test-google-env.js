import "../lib/load-env.js";
// tests/test-google-env.js
import { google } from "googleapis";
// samma cleanEnv som i utils.js
function cleanEnv(value) {
  if (!value) return value;
  return value.trim().replace(/^"|"$/g, "");
}
try {
  const creds = {
    client_email: cleanEnv(process.env.GCP_CLIENT_EMAIL),
    private_key: cleanEnv(process.env.GCP_PRIVATE_KEY)?.replace(/\\n/g, "\n"),
    project_id: process.env.GCP_PROJECT_ID,
  };
  console.log("🔍 Kontroll av GCP-miljövariabler:");
  console.log("CLIENT_EMAIL:", creds.client_email);
  if (creds.private_key) {
    console.log(
      "PRIVATE_KEY start:",
      creds.private_key.substring(0, 40).replace(/\n/g, "\\n"),
      "..."
    );
    console.log(
      "PRIVATE_KEY end:",
      creds.private_key.substring(creds.private_key.length - 40).replace(/\n/g, "\\n")
    );
  } else {
    console.log("PRIVATE_KEY saknas!");
  }
  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const client = await auth.getClient();
  console.log("✅ GoogleAuth-klient skapades utan fel");
} catch (err) {
  console.error("❌ GoogleAuth error:", err.message);
}
