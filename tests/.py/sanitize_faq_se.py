import os
import gspread
import json
import re
from dotenv import load_dotenv

# 🔑 Ladda miljövariabler
load_dotenv(".env.local")

SHEET_ID = os.getenv("SHEET_ID_MAIN")
GCP_PROJECT_ID = os.getenv("GCP_PROJECT_ID")
GCP_CLIENT_EMAIL = os.getenv("GCP_CLIENT_EMAIL")
GCP_PRIVATE_KEY = os.getenv("GCP_PRIVATE_KEY")

# 🔐 Google auth via service account
creds = {
    "type": "service_account",
    "project_id": GCP_PROJECT_ID,
    "private_key_id": "dummy",
    "private_key": GCP_PRIVATE_KEY.replace("\\n", "\n"),
    "client_email": GCP_CLIENT_EMAIL,
    "client_id": "dummy",
    "token_uri": "https://oauth2.googleapis.com/token",
}
gc = gspread.service_account_from_dict(creds)
sh = gc.open_by_key(SHEET_ID)

# ✅ Peka på rätt facit-fil
FACIT_FILE = "faq-extended/valid_formats_by_series.series.json"

def load_facit():
    with open(FACIT_FILE, "r", encoding="utf-8") as f:
        return json.load(f)

def sanitize_faq_se():
    facit = load_facit()
    ws = sh.worksheet("FAQ_SE")
    data = ws.get_all_records()

    updated_count = 0
    missing_series = []

    for idx, row in enumerate(data, start=2):  # start=2 → rad 1 = headers
        q = row.get("question_se", "")
        a = row.get("answer_se", "")

        matched = False
        for serie, info in facit.items():
            if serie.lower() in q.lower():
                matched = True
                valid_formats = info["formats"]
                colors = info["colors"]

                # Bygg nytt svar
                new_answer = f"Följande färger finns i serien {serie}: {', '.join(colors)}\nTillgängliga format: {', '.join(valid_formats)}"

                if new_answer != a:
                    col_idx = list(row.keys()).index("answer_se") + 1
                    ws.update_cell(idx, col_idx, new_answer)
                    updated_count += 1
                break

        if not matched and any(word in q.lower() for word in ["vilka färger", "format"]):
            missing_series.append(q)

        # Progress log var 20:e rad
        if idx % 20 == 0:
            print(f"✅ Rad {idx} bearbetad, uppdaterade hittills: {updated_count}")

    print(f"🎉 FAQ_SE sanerad. Totalt uppdaterade svar: {updated_count}")
    if missing_series:
        print("⚠️ Följande frågor matchade ingen serie i facit:")
        for q in missing_series:
            print(" -", q)

if __name__ == "__main__":
    sanitize_faq_se()
