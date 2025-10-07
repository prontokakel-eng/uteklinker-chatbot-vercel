import gspread
import pandas as pd
import time
import os
import json
from dotenv import load_dotenv
from openai import OpenAI

# 🔑 Läs env
load_dotenv(".env.local")

SHEET_ID = os.getenv("SHEET_ID_MAIN")
GCP_PROJECT_ID = os.getenv("GCP_PROJECT_ID")
GCP_CLIENT_EMAIL = os.getenv("GCP_CLIENT_EMAIL")
GCP_PRIVATE_KEY = os.getenv("GCP_PRIVATE_KEY")

if not all([SHEET_ID, GCP_PROJECT_ID, GCP_CLIENT_EMAIL, GCP_PRIVATE_KEY]):
    raise RuntimeError("❌ En eller flera miljövariabler saknas i .env.local")

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

# -----------------------------
# Resten av din befintliga kod
# -----------------------------

# OpenAI-klient
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Cachefil för översättningar
CACHE_FILE = ".cache_faq_translate.json"
if os.path.exists(CACHE_FILE):
    with open(CACHE_FILE, "r", encoding="utf-8") as f:
        cache = json.load(f)
else:
    cache = {}

def save_cache():
    with open(CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False, indent=2)

# Hämta färger/serier som ska skyddas
with open("faq_colors_from_pronto_se_v2.json", "r", encoding="utf-8") as f:
    protected_words = set(json.load(f))

def translate_text(text, target_lang, row_id):
    """Försök hämta från cache, annars OpenAI."""
    key = f"{text}::{target_lang}"
    if key in cache:
        return cache[key], "CACHE"

    # Skydda produktnamn/färger
    for word in protected_words:
        if word in text:
            cache[key] = text
            return text, "PROTECTED"

    # Översätt via OpenAI
    prompt = f"Translate this FAQ text into {target_lang}. Keep brand names, product series, and colors unchanged:\n\n{text}"
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": prompt}],
        temperature=0.1,
    )
    translated = response.choices[0].message.content.strip()
    cache[key] = translated
    return translated, "OPENAI"

def process_sheet(limit=None):
    ws_se = sh.worksheet("FAQ_SE")
    data = ws_se.get_all_records()

    # Skapa målsheets
    ws_en = sh.worksheet("FAQ_EN")
    ws_da = sh.worksheet("FAQ_DA")
    ws_de = sh.worksheet("FAQ_DE")

    updates_en, updates_da, updates_de = [], [], []

    for idx, row in enumerate(data):
        if limit and idx >= limit:
            break
        q_se, a_se, a_full_se = row["question_se"], row["answer_se"], row["answer_full_se"]

        for lang, updates, ws in [
            ("English", updates_en, ws_en),
            ("Danish", updates_da, ws_da),
            ("German", updates_de, ws_de),
        ]:
            tq, src1 = translate_text(q_se, lang, idx)
            ta, src2 = translate_text(a_se, lang, idx)
            taf, src3 = translate_text(a_full_se, lang, idx)

            updates.append([tq, ta, taf, f"{src1}/{src2}/{src3}"])

    # Batch update tillbaka till Google Sheets
    def write_updates(ws, updates, lang):
        ws.clear()
        ws.append_row([f"question_{lang[:2].lower()}", f"answer_{lang[:2].lower()}", f"answer_full_{lang[:2].lower()}", "Source"])
        for batch_start in range(0, len(updates), 200):
            batch = updates[batch_start:batch_start+200]
            ws.append_rows(batch)
            time.sleep(5)

    write_updates(ws_en, updates_en, "English")
    write_updates(ws_da, updates_da, "Danish")
    write_updates(ws_de, updates_de, "German")

    save_cache()
    print("✅ Translation finished and written to sheets.")

def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, help="Limit antal rader för test")
    args = parser.parse_args()

    process_sheet(limit=args.limit)

if __name__ == "__main__":
    main()
