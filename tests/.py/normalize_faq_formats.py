import os
import re
import csv
import time
import gspread
from dotenv import load_dotenv

# ---------------------------------------------------
# 🔑 Läs miljövariabler
# ---------------------------------------------------
load_dotenv(".env.local")

SHEET_ID = os.getenv("SHEET_ID_MAIN")
GCP_PROJECT_ID = os.getenv("GCP_PROJECT_ID")
GCP_CLIENT_EMAIL = os.getenv("GCP_CLIENT_EMAIL")
GCP_PRIVATE_KEY = os.getenv("GCP_PRIVATE_KEY")

# ---------------------------------------------------
# 🔐 Google Sheets-auth
# ---------------------------------------------------
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

# ---------------------------------------------------
# ⚙️ Config
# ---------------------------------------------------
DRY_RUN = os.getenv("DRY_RUN", "True").lower() == "true"

BAD_FORMATS = {"0x80","430x120","440x120","560x60","860x60","4x120","4x60","8x120","40x180"}
WHITELIST = {"20x120","40x120","60x60","80x80","90x90","120x120","30x120","45x90","80x180"}

def normalize_formats(text: str):
    """Returnerar tuple (ny_text, change_type)"""
    if not text:
        return text, None

    matches = re.findall(r"\d+x\d+", text)
    for m in matches:
        if m in BAD_FORMATS or m not in WHITELIST:
            return text.replace(m, "INVALID_FORMAT"), "INVALID"
        elif m in WHITELIST and not text.endswith("cm"):
            return text.replace(m, f"{m}cm"), "NORMALIZED"

    return text, None

# ---------------------------------------------------
# 📑 Flikar att behandla
# ---------------------------------------------------
FAQ_SHEETS = ["FAQ_SE", "FAQ_EN", "FAQ_DA", "FAQ_DE"]

# ---------------------------------------------------
# 🚀 Main
# ---------------------------------------------------
def process_sheet(sheet_name, writer):
    ws = sh.worksheet(sheet_name)
    rows = ws.get_all_records()
    headers = list(rows[0].keys()) if rows else []
    updates = []
    changes = 0
    removed_rows = 0

    for idx, row in enumerate(rows, start=2):  # start=2 → hoppa header
        row_changed = False
        new_row = []
        contains_only_invalid = True

        for key, value in row.items():
            if isinstance(value, str):
                normalized, change_type = normalize_formats(value)
                if change_type:  # någon ändring
                    row_changed = True
                    changes += 1
                    writer.writerow([sheet_name, idx, key, value, normalized, change_type])
                if "INVALID_FORMAT" not in normalized:
                    contains_only_invalid = False
                new_row.append(normalized)
            else:
                new_row.append(value)

        if contains_only_invalid and row_changed:
            removed_rows += 1
            writer.writerow([sheet_name, idx, "ROW_REMOVED", str(row), "", "INVALID_ROW"])
            continue

        updates.append(new_row)

    if not DRY_RUN:
        ws.clear()
        ws.append_row(headers)  # header
        for batch_start in range(0, len(updates), 200):
            ws.append_rows(updates[batch_start:batch_start+200])
            time.sleep(3)

    return len(updates), changes, removed_rows

def main():
    summary = {}

    with open("faq_formats_patch_log.csv", "w", encoding="utf-8", newline="") as logfile:
        writer = csv.writer(logfile)
        writer.writerow(["Tab","Row","Col","Original","Patched","ChangeType"])

        total_rows = 0
        total_changes = 0
        total_removed = 0

        for sheet_name in FAQ_SHEETS:
            count, changes, removed = process_sheet(sheet_name, writer)
            print(f"🔎 {sheet_name} {'skulle uppdateras' if DRY_RUN else 'uppdaterad'} "
                  f"({count} rader kvar, {changes} ändringar, {removed} rader borttagna)")
            summary[sheet_name] = {"rows": count, "changes": changes, "removed": removed}
            total_rows += count
            total_changes += changes
            total_removed += removed

    print(f"\n📄 Logg sparad i faq_formats_patch_log.csv")
    print(f"Totalt kvarvarande rader: {total_rows}, totala ändringar: {total_changes}, borttagna rader: {total_removed}\n")

    # 🔎 Sanity check
    for sheet_name in FAQ_SHEETS:
        ws = sh.worksheet(sheet_name)
        values = ws.get_all_values()
        flat = [cell for row in values for cell in row]
        invalids = sum(1 for cell in flat if "INVALID_FORMAT" in cell)
        print(f"✅ {sheet_name}: {summary[sheet_name]['changes']} ändringar, "
              f"{summary[sheet_name]['removed']} rader borttagna, "
              f"{invalids} st 'INVALID_FORMAT' i slutdata")

if __name__ == "__main__":
    main()
