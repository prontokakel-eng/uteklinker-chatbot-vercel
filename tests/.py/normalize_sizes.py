import os
import re
import json
import time
import sys
from pathlib import Path

import gspread
from dotenv import load_dotenv

# ---------- Helpers: find project root & .env.local ----------
def find_project_root(start: Path, markers=(".env.local", "config")) -> Path:
    cur = start.resolve()
    for _ in range(8):
        has_any = any((cur / m).exists() for m in markers)
        if has_any:
            return cur
        cur = cur.parent
    return start.resolve()

HERE = Path(__file__).parent
ROOT = find_project_root(HERE)

dotenv_path = ROOT / ".env.local"
if dotenv_path.exists():
    load_dotenv(dotenv_path)
else:
    load_dotenv(".env.local")

# ---------- Env & clients ----------
GCP_PROJECT_ID = os.getenv("GCP_PROJECT_ID")
GCP_CLIENT_EMAIL = os.getenv("GCP_CLIENT_EMAIL")
GCP_PRIVATE_KEY = os.getenv("GCP_PRIVATE_KEY")
SHEET_ID_MAIN = os.getenv("SHEET_ID_MAIN")

missing = [k for k,v in {
    "GCP_PROJECT_ID": GCP_PROJECT_ID,
    "GCP_CLIENT_EMAIL": GCP_CLIENT_EMAIL,
    "GCP_PRIVATE_KEY": GCP_PRIVATE_KEY,
    "SHEET_ID_MAIN": SHEET_ID_MAIN,
}.items() if not v]
if missing:
    print(f"❌ Missing env vars in .env.local at {dotenv_path}: {', '.join(missing)}")
    sys.exit(1)

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
sh = gc.open_by_key(SHEET_ID_MAIN)

SHEETS = ["SE_FULL_LOOKUP", "EN_FULL_LOOKUP", "DA_FULL_LOOKUP", "DE_FULL_LOOKUP"]
BATCH_SIZE = 20
SLEEP_SECONDS = 2

# Regex for size patterns like 60x60, 60 x 60, 60x60cm, 60 x 60 cm
size_pattern = re.compile(r'^\s*(\d{2,3})\s*[xX]\s*(\d{2,3})(\s*cm)?\s*$')

# Collect variants per normalized size
size_variants = {}

def normalize_word(word: str):
    original = word.strip()
    m = size_pattern.match(original)
    if m:
        w, h = m.group(1), m.group(2)
        normalized = f"{w}x{h}"
        if normalized not in size_variants:
            size_variants[normalized] = set()
        size_variants[normalized].add(original)
        return normalized, True
    else:
        trimmed = original.strip()
        if trimmed != original:
            return trimmed, True
        return original, False

def process_sheet(sheet_name: str):
    ws = sh.worksheet(sheet_name)
    col = ws.col_values(1)
    total = len(col)
    batch_updates = []
    normalized_count = 0

    for i, word in enumerate(col, start=1):
        new_val, changed = normalize_word(word)
        if changed:
            normalized_count += 1
            batch_updates.append({"range": f"{sheet_name}!A{i}", "values": [[new_val]]})
            batch_updates.append({"range": f"{sheet_name}!C{i}", "values": [["normalized"]]})
            print(f"✅ {sheet_name} row {i}: {word} -> {new_val}")

        if len(batch_updates) >= BATCH_SIZE*2:
            body = {"valueInputOption": "USER_ENTERED", "data": list(batch_updates)}
            sh.values_batch_update(body)
            print(f"💾 Saved batch up to row {i} in {sheet_name}")
            batch_updates.clear()
            time.sleep(SLEEP_SECONDS)

    if batch_updates:
        body = {"valueInputOption": "USER_ENTERED", "data": list(batch_updates)}
        sh.values_batch_update(body)
        print(f"💾 Saved final batch in {sheet_name}")

    print(f"🚀 Done {sheet_name}, normalized={normalized_count}/{total}")

def main():
    for sheet in SHEETS:
        process_sheet(sheet)

    # Save size variants to /config/keywords/sizes.json
    out_dir = ROOT / "config" / "keywords"
    out_dir.mkdir(parents=True, exist_ok=True)
    out_path = out_dir / "sizes.json"

    serializable = {k: sorted(list(v)) for k,v in size_variants.items()}
    out_path.write_text(json.dumps(serializable, indent=2, ensure_ascii=False), encoding="utf-8")
    print(f"💾 Saved size variants JSON to {out_path}")

if __name__ == "__main__":
    main()
