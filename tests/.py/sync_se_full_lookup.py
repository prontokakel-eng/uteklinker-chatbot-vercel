import os
import sys
import csv
import gspread
from dotenv import load_dotenv

# ----------------------------
# Konfig
# ----------------------------
load_dotenv(".env.local")
SPREADSHEET_ID = os.getenv("SHEET_ID_MAIN") or os.getenv("SHEET_ID") or os.getenv("SHEET_ID_TEST")
SE_SHEET = "SE_FULL_LOOKUP"
SOURCE_LABEL = "MERGED"

# CLI: tillåt valfri CSV-sökväg, default "data/faq_keywords_se_corrected.csv"
INPUT_CSV = sys.argv[1] if len(sys.argv) > 1 else "data/faq_keywords_se_corrected.csv"

# Service account creds
GCP_EMAIL = os.getenv("GCP_CLIENT_EMAIL")
GCP_KEY = (os.getenv("GCP_PRIVATE_KEY") or "").replace("\\n", "\n")
GCP_PROJECT = os.getenv("GCP_PROJECT_ID")

# ----------------------------
# Hjälpfunktioner
# ----------------------------
def normalize_se(word: str) -> str:
    """Normalisera för jämförelse/dedupe (gemener, trims, specialfall)."""
    if not isinstance(word, str):
        return ""
    w = word.strip()
    # specialfixar
    if w == "0x80":
        w = "80x80"
    if w.lower() == "uv":
        w = "UV-tålig"
    if w.lower() == "ce":
        w = "CE-märkning"
    return w

def should_keep(word: str) -> bool:
    """Filtrera bort < 3 tecken (utom specialfallen som redan upphöjts ovan)."""
    if not word:
        return False
    if word in ("UV-tålig", "CE-märkning"):
        return True
    return len(word) >= 3

def load_csv_words(path: str):
    words = []
    with open(path, "r", encoding="utf-8-sig", newline="") as f:
        reader = csv.reader(f)
        # Hantera både 1-kolumn (SE) och ev. header
        headers = next(reader, None)
        # Om första raden inte ser ut som data, försök läsa resten
        def is_data_row(row):
            return bool(row) and any(cell.strip() for cell in row)
        if headers and is_data_row(headers):
            # headers var egentligen första raden data
            row = headers
            if row and row[0].strip():
                words.append(row[0].strip())
        for row in reader:
            if not row: 
                continue
            if row[0].strip():
                words.append(row[0].strip())
    return words

# ----------------------------
# Körning
# ----------------------------
def main():
    if not SPREADSHEET_ID:
        print("❌ Hittade inget SHEET_ID i .env.local (SHEET_ID_MAIN / SHEET_ID / SHEET_ID_TEST).")
        sys.exit(1)

    if not os.path.exists(INPUT_CSV):
        print(f"❌ Kunde inte hitta input CSV: {INPUT_CSV}")
        print("   Tips: ladda ner 'faq_keywords_se_corrected.csv' och spara som data/faq_keywords_se_corrected.csv")
        sys.exit(1)

    # Ladda kandidatord från CSV
    csv_words_raw = load_csv_words(INPUT_CSV)
    csv_words_norm = []
    for w in csv_words_raw:
        nw = normalize_se(w)
        if should_keep(nw):
            csv_words_norm.append(nw)
    # Behåll ordning men dedupe
    seen = set()
    csv_words = []
    for w in csv_words_norm:
        key = w.lower()
        if key not in seen:
            seen.add(key)
            csv_words.append(w)

    # Anslut Sheets
    creds = {
        "type": "service_account",
        "project_id": GCP_PROJECT or "dummy",
        "private_key_id": "dummy",
        "private_key": GCP_KEY,
        "client_email": GCP_EMAIL,
        "client_id": "dummy",
        "token_uri": "https://oauth2.googleapis.com/token"
    }
    gc = gspread.service_account_from_dict(creds)
    sh = gc.open_by_key(SPREADSHEET_ID)
    ws = sh.worksheet(SE_SHEET)

    # Läs befintliga kolumner
    colA = ws.col_values(1)  # keywords
    colB = ws.col_values(2)  # source (om saknas fyller vi vid behov)

    # Rensa ev. header-rad (om första cellen ser ut som header)
    def drop_header(values):
        if values and values[0].strip().lower() in ("se", "keyword", "keywords"):
            return values[1:]
        return values
    colA = drop_header(colA)
    colB = drop_header(colB)

    existing_norm = {normalize_se(x).strip().lower() for x in colA if x and x.strip()}
    to_add = [w for w in csv_words if w.strip().lower() not in existing_norm]

    print(f"📊 Befintliga i SE_FULL_LOOKUP: {len(existing_norm)}")
    print(f"🧩 Kandidater från CSV: {len(csv_words)}")
    print(f"➕ Nya att lägga till: {len(to_add)}")

    if not to_add:
        print("✅ Inget att lägga till. SE_FULL_LOOKUP är redan ifylld.")
        return

    # Förbered rader att append:a (A=keyword, B=Source)
    new_rows = [[w, SOURCE_LABEL] for w in to_add]

    # Append i batch för hastighet
    ws.append_rows(new_rows, value_input_option="USER_ENTERED")

    print(f"🎉 Klart! Lade till {len(new_rows)} nya rader i {SE_SHEET}.")
    print("👉 Nästa steg: kör översättningen för EN/DA/DE på de nya raderna.")

if __name__ == "__main__":
    main()
