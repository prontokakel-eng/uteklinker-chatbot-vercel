import os
import gspread
import pandas as pd
import json
from dotenv import load_dotenv
from openai import OpenAI
from itertools import islice

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

# --- NYTT: Läs in serier/färger från JSON och bygg DO_NOT_TRANSLATE ---
colors_file = os.path.join("faq-extended", "faq_colors_from_pronto_se_v2.json")
DO_NOT_TRANSLATE = set()
try:
    with open(colors_file, encoding="utf-8") as f:
        colors_data = json.load(f)
    for item in colors_data:
        # serienamn
        q = item.get("question_se", "")
        if "serien" in q:
            serie = q.split("serien")[-1].strip(" ?")
            if serie:
                DO_NOT_TRANSLATE.add(serie)
        # färgnamn
        a = item.get("answer_se", "")
        for line in a.split("\\n"):
            if line.strip().startswith("-"):
                color = line.split("(")[0].strip("- ").strip()
                if color:
                    DO_NOT_TRANSLATE.add(color)
    print(f"🚫 Skyddar {len(DO_NOT_TRANSLATE)} domänord (serier & färger) från översättning")
except FileNotFoundError:
    print("⚠️ Kunde inte läsa färg/serie-listan – fortsätter utan skydd.")

def safe_translate(text, src_lang, tgt_lang, row_idx):
    if not isinstance(text, str) or text.strip() == "":
        return text
    if text.strip() in DO_NOT_TRANSLATE:
        print(f"⏭️  Rad {row_idx}: hoppade över '{text}' (skyddat domänord)")
        return text  # behåll originalet om det är serie/färg
    try:
        prompt = (
            f"Översätt följande keyword från {src_lang} till {tgt_lang}. "
            f"Svara endast med ett enda ord eller en kort fras, inget annat. "
            f"Viktigt: översätt aldrig domänorden för serier och färger.\n\n{text}"
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

# --- Hjälpfunktion för batchning ---
def chunks(iterable, size):
    it = iter(iterable)
    while True:
        batch = list(islice(it, size))
        if not batch:
            return
        yield batch

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
        for batch in chunks(to_add, 500):
            ws_se.append_rows([[w, "MERGED"] for w in batch], value_input_option="USER_ENTERED")
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
            if not (col_keywords[i] or "").strip():
                translated = safe_translate(se_kw, "Svenska", lang, i+1)
                col_keywords[i] = translated
                col_source[i] = "AI"
                updates_kw.append((i+1, translated))
                updates_src.append((i+1, "AI"))

            if (i+1) % 50 == 0:
                print(f"✅ {lang}: {i+1}/{len(se_keywords)} klara")

        # --- Batch update istället för cell-för-cell ---
        def build_valueranges(rows, col_letter):
            for start in range(0, len(rows), 500):
                part = rows[start:start+500]
                if not part:
                    continue
                first_row = part[0][0]
                last_row = part[-1][0]
                values = [[val] for _, val in part]
                yield {
                    "range": f"{sheet_name}!{col_letter}{first_row}:{col_letter}{last_row}",
                    "majorDimension": "ROWS",
                    "values": values,
                }

        data_payload = []
        if updates_kw:
            data_payload.extend(build_valueranges(updates_kw, "A"))
        if updates_src:
            data_payload.extend(build_valueranges(updates_src, "B"))

        if data_payload:
            body = {"valueInputOption": "USER_ENTERED", "data": list(data_payload)}
            sh.values_batch_update(body)
            print(f"🎉 {lang}: Batch-uppdaterade {len(updates_kw)} keywords")

        # Summering per språk
        src_vals = ws_lang.col_values(2)
        ai_count = sum(1 for v in src_vals if (v or "").strip().upper() == "AI")
        copied_count = sum(1 for v in src_vals if (v or "").strip().upper() in {"MERGED", "COPIED"})
        print(f"🔎 {lang} summering – AI: {ai_count}, COPIED/MERGED: {copied_count}")

    print("🚀 Klar! Alla språk är synkade och översatta.")

if __name__ == "__main__":
    main()
