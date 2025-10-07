#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
upload_normalized_faq.py (patchad)
---------------------------------
Laddar upp normaliserad FAQ (faq_se_normalized.json) till Google Sheets fliken FAQ_SE.
- Input: faq-extended/faq_se_normalized.json
- Output: FAQ_SE-fliken i SHEET_ID_MAIN (Google Sheets)
- Kolumner: question_se | answer_se | answer_full_se
- Batchar 200 rader / 5 sekunder för att undvika 429-fel
"""

import os
import json
import time
from pathlib import Path
import gspread

try:
    from dotenv import load_dotenv
except Exception:
    load_dotenv = None

# --------- Paths ---------
ROOT = Path.cwd()  # använd alltid arbetsmappen där du kör scriptet
INPUT_PATH = ROOT / "faq-extended" / "faq_se_normalized.json"

# --------- Auth ---------
def get_gspread_client():
    if load_dotenv:
        load_dotenv(ROOT / ".env.local")

    SHEET_ID = os.getenv("SHEET_ID_MAIN")
    GCP_PROJECT_ID = os.getenv("GCP_PROJECT_ID")
    GCP_CLIENT_EMAIL = os.getenv("GCP_CLIENT_EMAIL")
    GCP_PRIVATE_KEY = os.getenv("GCP_PRIVATE_KEY")

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
    return gc.open_by_key(SHEET_ID)

# --------- Main ---------
def main():
    if not INPUT_PATH.exists():
        print(f"❌ Inputfil saknas: {INPUT_PATH}")
        return

    data = json.loads(INPUT_PATH.read_text(encoding="utf-8"))
    sh = get_gspread_client()
    ws = sh.worksheet("FAQ_SE")

    values = []
    for row in data:
        q = row.get("question_se", "").strip()
        a_short = row.get("answer_se", "").strip()
        a_full = row.get("answer_full_se", "").strip()
        values.append([q, a_short, a_full])

    total = len(values)
    print(f"📊 Totalt {total} rader att skriva till FAQ_SE")

    BATCH_SIZE = 200
    SLEEP_TIME = 5

    for start_idx in range(0, total, BATCH_SIZE):
        end_idx = min(start_idx + BATCH_SIZE, total)
        batch_values = values[start_idx:end_idx]
        cell_range = f"A{start_idx+2}:C{end_idx+1}"  # hoppa över header
        ws.update(cell_range, batch_values)
        print(f"✅ Sparade rader {start_idx+1}–{end_idx} till FAQ_SE")
        time.sleep(SLEEP_TIME)

    print("🎉 FAQ_SE uppdaterad klart!")

if __name__ == "__main__":
    main()
