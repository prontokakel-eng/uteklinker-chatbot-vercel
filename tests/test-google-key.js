import "../lib/load-env.js";
import { google } from "googleapis";
console.log("CLIENT_EMAIL:", JSON.stringify(process.env.GCP_CLIENT_EMAIL));
console.log("PRIVATE_KEY length:", process.env.GCP_PRIVATE_KEY?.length || 0);
try {
  const auth = new google.auth.GoogleAuth({
    credentials: {
      type: "service_account",
      project_id: process.env.GCP_PROJECT_ID,
      private_key_id: process.env.GCP_PRIVATE_KEY_ID,
      private_key: (process.env.GCP_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
      client_email: process.env.GCP_CLIENT_EMAIL,
      client_id: process.env.GCP_CLIENT_ID,
    },
    scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
  });
  const client = await auth.getClient();
  console.log("✅ Google Auth client created successfully");
} catch (err) {
  console.error("❌ Google Auth error:", err.message);
}