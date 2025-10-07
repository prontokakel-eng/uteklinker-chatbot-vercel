import os
import gspread
from dotenv import load_dotenv
from openai import OpenAI

# Ladda miljövariabler
load_dotenv(".env.local")

# Initiera OpenAI
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Initiera Google Sheets
gcp_email = os.getenv("GCP_CLIENT_EMAIL")
gcp_key = os.getenv("GCP_PRIVATE_KEY").replace("\\n", "\n")
gcp_project = os.getenv("GCP_PROJECT_ID")
spreadsheet_id = os.getenv("SHEET_ID_MAIN")

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

# Öppna dokumentet
sh = gc.open_by_key(spreadsheet_id)

# Flikar
LANGS = ["EN", "DA", "DE"]
SE_SHEET = "SE_FULL_LOOKUP"

def safe_translate(text, src_lang, tgt_lang, row_idx):
    """Kör översättning med fallback-loggning."""
    if not isinstance(text, str) or text.strip() == "":
        return text
    try:
        prompt = (
            f"Översätt följande keyword från {src_lang} till {tgt_lang}, "
            f"korta ord eller fraser, korrekt och domänspecifikt:\n\n{text}"
        )
        resp = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            temperature=0
        )
        return resp.choices[0].message.content.strip()
    except Exception as e:
        print(f"❌ Rad {row_idx}: {e}")
        return text

def main():
    ws_se = sh.worksheet(SE_SHEET)
    se_values = ws_se.col_values(1)  # keywords i kolumn A

    print(f"📊 Totalt {len(se_values)} keywords i {SE_SHEET}")

    for lang in LANGS:
        sheet_name = f"{lang}_FULL_LOOKUP"
        ws_lang = sh.worksheet(sheet_name)

        # Läs kolumner: keyword (A) + source (B)
        col_keywords = ws_lang.col_values(1)
        col_source = ws_lang.col_values(2) if len(ws_lang.row_values(1)) >= 2 else []

        # Säkerställ lika många rader
        while len(col_keywords) < len(se_values):
            col_keywords.append("")
        while len(col_source) < len(se_values):
            col_source.append("")

        updates_kw = []
        updates_src = []

        for i, se_kw in enumerate(se_values):
            if not col_keywords[i].strip():
                translated = safe_translate(se_kw, "Svenska", lang, i+1)
                col_keywords[i] = translated
                col_source[i] = "AI"
                updates_kw.append((i+1, translated))
                updates_src.append((i+1, "AI"))

            if (i+1) % 50 == 0:
                print(f"✅ {lang}: {i+1}/{len(se_values)} klara")

        # Skriv tillbaka ändringar
        for row_idx, new_val in updates_kw:
            ws_lang.update_cell(row_idx, 1, new_val)
        for row_idx, new_val in updates_src:
            ws_lang.update_cell(row_idx, 2, new_val)

    print("🎉 Klart! Alla översättningar + 'AI' source inskrivna i Google Sheet")

if __name__ == "__main__":
    main()
