import os
import re
import csv
import gspread
from dotenv import load_dotenv

# --- Ladda env ---
load_dotenv(".env.local")

# --- Google Sheets-auth ---
gcp_email = os.getenv("GCP_CLIENT_EMAIL")
gcp_key = os.getenv("GCP_PRIVATE_KEY").replace("\\n", "\n")
gcp_project = os.getenv("GCP_PROJECT_ID")
spreadsheet_id = os.getenv("SHEET_ID_MAIN")
DRY_RUN = os.getenv("DRY_RUN", "true").lower() == "true"

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
sh = gc.open_by_key(spreadsheet_id)

# --- Config ---
SHEET_TABS = ["SE_FULL_LOOKUP", "EN_FULL_LOOKUP", "DA_FULL_LOOKUP", "DE_FULL_LOOKUP"]

FORMAT_WHITELIST = {
    "10x10cm", "15x20cm", "20x120cm", "26.5x180cm", "30x120cm", "30x240cm",
    "40x80cm", "40x120cm", "45x90cm", "50x100cm", "60x60cm", "60x100cm", "60x120cm",
    "80x40cm", "80x80cm", "80x180cm", "90x90cm", "100x100cm", "120x120cm", "120x240cm"
}
BAD_FORMATS = {"0x80", "430x120", "440x120", "560x60", "860x60", "4x120", "4x60", "8x120"}

# --- Helpers ---
def normalize_format(text: str):
    if not text:
        return text, None
    match = re.match(r"^\s*(\d+(\.\d+)?)\s*[xX]\s*(\d+(\.\d+)?)(\s*cm)?\s*$", text)
    if match:
        fmt = f"{match.group(1)}x{match.group(3)}cm"
        if fmt in BAD_FORMATS:
            return fmt, "REMOVED"
        elif fmt in FORMAT_WHITELIST:
            return fmt, "NORMALIZED"
        else:
            return fmt, "INVALID"
    return text, None

def main():
    changes = []
    for tab in SHEET_TABS:
        ws = sh.worksheet(tab)
        values = ws.get_all_values()
        if not values:
            print(f"❌ Ingen data i {tab}")
            continue

        headers = values[0]
        new_values = [headers]

        for row_idx, row in enumerate(values[1:], start=2):
            new_row = []
            for col_idx, cell in enumerate(row):
                patched, status = normalize_format(cell)
                if status:
                    changes.append({
                        "Tab": tab,
                        "Row": row_idx,
                        "Col": headers[col_idx] if col_idx < len(headers) else f"Col{col_idx+1}",
                        "Original": cell,
                        "Patched": patched,
                        "ChangeType": status
                    })
                new_row.append(patched)
            new_values.append(new_row)

        if not DRY_RUN:
            ws.update(new_values)
            print(f"✅ Uppdaterade {tab} ({len(values)-1} rader)")
        else:
            print(f"🔎 DRY_RUN: {tab} skulle uppdateras ({len(values)-1} rader)")

    # Skriv logg
    log_file = "formats_patch_log.csv"
    with open(log_file, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["Tab", "Row", "Col", "Original", "Patched", "ChangeType"])
        writer.writeheader()
        writer.writerows(changes)

    print(f"📄 Logg sparad i {log_file}")
    print(f"Totala ändringar: {len(changes)}")

if __name__ == "__main__":
    main()
