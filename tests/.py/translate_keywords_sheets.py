import os
import gspread
import pandas as pd
from dotenv import load_dotenv
from openai import OpenAI

# Ladda miljövariabler
load_dotenv(".env.local")

# OpenAI-klienten
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Google Sheets-auth
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
sh = gc.open_by_key(spreadsheet_id)

# Flikar
SE_SHEET = "SE_FULL_LOOKUP"
LANGS = ["EN", "DA", "DE"]

def safe_translate(text, src_lang, tgt_lang, row_idx):
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
    # --- Steg 1: Läs slutlig SE-lista ---
    se_final_file = os.path.join("faq-extended", "faq_keywords_se_final.csv")
    df_se = pd.read_csv(se_final_file)
    se_keywords = df_se["SE"].dropna().astype(str).tolist()
    print(f"📊 Totalt {len(se_keywords)} SE-keywords att synka")

    # --- Steg 2: Synka SE_FULL_LOOKUP ---
    ws_se = sh.worksheet(SE_SHEET)
    existing_se = ws_se.col_values(1)
    existing_se_set = {w.strip().lower() for w in existing_se if w.strip()}

    to_add = [w for w in se_keywords if w.strip().lower() not in existing_se_set]
    if to_add:
        new_rows = [[w, "MERGED"] for w in to_add]
        ws_se.append_rows(new_rows, value_input_option="USER_ENTERED")
        print(f"➕ Lade till {len(to_add)} nya ord i {SE_SHEET}")
    else:
        print("✅ Alla SE-keywords finns redan i SE_FULL_LOOKUP")

    # --- Steg 3: Översätt till EN/DA/DE ---
    for lang in LANGS:
        sheet_name = f"{lang}_FULL_LOOKUP"
        ws_lang = sh.worksheet(sheet_name)

        # Hämta keywords + source
        col_keywords = ws_lang.col_values(1)
        col_source = ws_lang.col_values(2) if len(ws_lang.row_values(1)) >= 2 else []

        # Säkerställ längder
        while len(col_keywords) < len(se_keywords):
            col_keywords.append("")
        while len(col_source) < len(se_keywords):
            col_source.append("")

        updates_kw = []
        updates_src = []

        for i, se_kw in enumerate(se_keywords):
            if not col_keywords[i].strip():
                translated = safe_translate(se_kw, "Svenska", lang, i+1)
                col_keywords[i] = translated
                col_source[i] = "AI"
                updates_kw.append((i+1, translated))
                updates_src.append((i+1, "AI"))

            if (i+1) % 50 == 0:
                print(f"✅ {lang}: {i+1}/{len(se_keywords)} klara")

        # Skriv ändringar till Google Sheet
        for row_idx, new_val in updates_kw:
            ws_lang.update_cell(row_idx, 1, new_val)
        for row_idx, new_val in updates_src:
            ws_lang.update_cell(row_idx, 2, new_val)

        print(f"🎉 {lang}: Uppdaterade {len(updates_kw)} nya keywords")

    print("🚀 Klar! Alla språk är synkade och översatta.")

if __name__ == "__main__":
    main()
