import gspread
import pandas as pd
import time
import os
from dotenv import load_dotenv

# 🔑 Läs env
load_dotenv(".env.local")

SHEET_ID = os.getenv("SHEET_ID_MAIN")
GCP_PROJECT_ID = os.getenv("GCP_PROJECT_ID")
GCP_CLIENT_EMAIL = os.getenv("GCP_CLIENT_EMAIL")
GCP_PRIVATE_KEY = os.getenv("GCP_PRIVATE_KEY")

# 🔐 Google auth via service account från env
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

# 📂 Normaliserade CSV-filer → rätt flikar
base_dir = os.path.join(os.path.dirname(__file__), "..", "..", "faq-extended")

csv_files = {
    "SE_FULL_LOOKUP": os.path.join(base_dir, "Faq + keywords SE DA EN DE - SE_FULL_LOOKUP.csv"),
    "EN_FULL_LOOKUP": os.path.join(base_dir, "Faq + keywords SE DA EN DE - EN_FULL_LOOKUP.csv"),
    "DA_FULL_LOOKUP": os.path.join(base_dir, "Faq + keywords SE DA EN DE - DA_FULL_LOOKUP.csv"),
    "DE_FULL_LOOKUP": os.path.join(base_dir, "Faq + keywords SE DA EN DE - DE_FULL_LOOKUP.csv")
}

BATCH_SIZE = 200
SLEEP_TIME = 5  # sekunder mellan batchar

for sheet_name, csv_path in csv_files.items():
    print(f"⏳ Uppdaterar {sheet_name} från {csv_path}")
    df = pd.read_csv(csv_path, encoding="utf-8")

    # välj rätt kolumn
    col = "Tile" if "Tile" in df.columns else df.columns[0]

    values = [[v] for v in df[col].tolist()]
    total = len(values)

    for start_idx in range(0, total, BATCH_SIZE):
        end_idx = min(start_idx + BATCH_SIZE, total)
        batch_values = values[start_idx:end_idx]
        cell_range = f"A{start_idx+1}:A{end_idx}"   # <-- 🔄 SKRIVER I KOLUMN A NU
        ws = sh.worksheet(sheet_name)
        ws.update(cell_range, batch_values)
        print(f"✅ {sheet_name}: Sparade {end_idx}/{total} rader i kolumn A")
        time.sleep(SLEEP_TIME)

print("🎉 Alla språk uppdaterade klart i kolumn A!")
