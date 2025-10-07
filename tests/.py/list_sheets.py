import os
import gspread
from dotenv import load_dotenv

# Ladda miljövariabler
load_dotenv(".env.local")

spreadsheet_id = os.getenv("SHEET_ID_MAIN")
print("📌 Försöker öppna Spreadsheet ID:", spreadsheet_id)

gcp_email = os.getenv("GCP_CLIENT_EMAIL")
print("📌 Använder servicekonto:", gcp_email)

gcp_key = os.getenv("GCP_PRIVATE_KEY").replace("\\n", "\n")
gcp_project = os.getenv("GCP_PROJECT_ID")

creds = {
    "type": "service_account",
    "project_id": gcp_project,
    "private_key_id": "dummy",
    "private_key": gcp_key,
    "client_email": gcp_email,
    "client_id": "dummy",
    "token_uri": "https://oauth2.googleapis.com/token"
}

gc = gspread.service_account_from_dict(creds)

try:
    sh = gc.open_by_key(spreadsheet_id)
    worksheets = sh.worksheets()
    print("✅ Flikar i dokumentet:")
    for ws in worksheets:
        print("-", ws.title)
except Exception as e:
    print("❌ Kunde inte öppna arket!")
    print("Felmeddelande:", e)
    print("\n🔍 Felsökning:")
    print("1. Är SHEET_ID_MAIN korrekt? Testa öppna i webbläsare:")
    print(f"   https://docs.google.com/spreadsheets/d/{spreadsheet_id}/edit")
    print("2. Har servicekontot åtkomst? Dela arket med:", gcp_email)
    print("3. Är .env.local rätt laddad?")
