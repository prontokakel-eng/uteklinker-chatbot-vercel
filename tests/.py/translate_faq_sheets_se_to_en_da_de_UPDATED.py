import os
import json
import re
import gspread
from dotenv import load_dotenv
from openai import OpenAI

# 🔑 Ladda miljövariabler
load_dotenv(".env.local")

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
sh = gc.open_by_key(SHEET_ID)

# 📂 Cache
CACHE_FILE = "faq-extended/cache/faq_translate.json"
LOG_FILE = "faq-extended/logg/translate_run.log"
if os.path.exists(CACHE_FILE):
    with open(CACHE_FILE, "r", encoding="utf-8") as f:
        try:
            cache = json.load(f)
        except Exception:
            cache = {}
else:
    cache = {}

# 📂 Facit med giltiga format
with open("faq-extended/valid_formats_by_series.cleaned.json", "r", encoding="utf-8") as f:
    valid_formats = json.load(f)

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

import logging
os.makedirs("faq-extended/cache", exist_ok=True)
os.makedirs("faq-extended/logg", exist_ok=True)
logging.basicConfig(filename=LOG_FILE, level=logging.INFO, format="%(asctime)s %(message)s")


FAQ_SHEETS = {"SE":"FAQ_SE","EN":"FAQ_EN","DA":"FAQ_DA","DE":"FAQ_DE"}

LANG_PROMPTS = {
    "EN": "Translate the following FAQ (question and answer) from Swedish to English. Keep series names, colors, and formats unchanged if they exist.",
    "DA": "Oversæt følgende FAQ (spørgsmål og svar) fra svensk til dansk. Behold serienavne, farver og formater uændrede, hvis de findes.",
    "DE": "Übersetzen Sie die folgende FAQ (Frage und Antwort) vom Schwedischen ins Deutsche. Seriennamen, Farben und Formate unverändert lassen, falls vorhanden."
}

FORMAT_LABEL = {"EN":"Available formats","DA":"Tilgængelige formater","DE":"Verfügbare Formate","SE":"Tillgängliga format"}

# 🧹 Regex för alla mått
DIM_RX = re.compile(r"(\d{1,3}(?:,\d{1,2})?\s*x\s*\d{1,3}(?:,\d{1,2})?\s*(?:cm)?)", re.IGNORECASE)

def series_valid_set(serie: str):
    s = set()
    if serie and serie in valid_formats:
        for _, flist in valid_formats[serie].items():
            s.update(flist)
    return s

def normalize_formats(text: str, serie: str, target_lang: str) -> str:
    """Ta bort ALLA mått som inte finns i facit och lägg alltid in korrekt facit-rad."""
    if not isinstance(text, str) or not serie or serie not in valid_formats:
        return text

    valid_set = series_valid_set(serie)

    # Canonicalisering
    def canon(token: str) -> str:
        t = token.lower().replace(" ", "")
        if not t.endswith("cm"):
            t += "cm"
        return t

    # 1) Ta bort alla tokens som inte matchar facit
    text = DIM_RX.sub(lambda m: m.group(1) if canon(m.group(1)) in valid_set else "", text)

    # 2) Lägg alltid till en facit-rad
    label = FORMAT_LABEL.get(target_lang, "Available formats")
    facit_line = f"{label}: {', '.join(sorted(valid_set))}"
    if facit_line not in text:
        if not text.endswith("\n"):
            text += "\n"
        text += facit_line

    logging.info(f"      ↪ Normaliserade format för serie '{serie}' → {facit_line}")
    return text

def is_swedish(text: str) -> bool:
    sw = ["är","och","inte","eller","plattor","ytan","mycket","finns","vilka","hur","påverkas","kan","säker","halk"]
    return sum(1 for w in sw if w in text.lower()) >= 2

def translate_text(text: str, target_lang: str, serie: str):
    key = f"{target_lang}::{text.strip()}"
    if key in cache:
        logging.info(f"   ↪ [CACHE] {target_lang} :: {text[:60]}...")
        return cache[key], "CACHE"

    prompt = f"Translate the following from Swedish to {target_lang}. Always output in {target_lang}. Keep series names, colors, and formats unchanged:\n\n{text}"
    resp = client.chat.completions.create(
        model="gpt-4o",
        messages=[
            {"role": "system", "content": LANG_PROMPTS[target_lang]},
            {"role": "user", "content": prompt}
        ],
        temperature=0.2
    )
    translated = resp.choices[0].message.content.strip()

    # Efterkontroll
    if is_swedish(translated):
        logging.info(f"      ⚠️ Detekterade svenska i {target_lang}-output, kör om striktare...")
        strict_prompt = f"The following text is in Swedish. You must output only in {target_lang}. Do not output Swedish. Keep product series names, colors, and formats unchanged:\n\n{text}"
        resp2 = client.chat.completions.create(
            model="gpt-4o",
            messages=[
                {"role": "system", "content": LANG_PROMPTS[target_lang]},
                {"role": "user", "content": strict_prompt}
            ],
            temperature=0.0
        )
        translated = resp2.choices[0].message.content.strip()

    cache[key] = translated
    logging.info(f"   ↪ [AI] {target_lang} :: {text[:60]}...")
    return translated, "AI"

def process_sheet():
    ws_se = sh.worksheet(FAQ_SHEETS["SE"])
    rows = ws_se.get_all_records()

    out_data = {lang: [] for lang in ["EN", "DA", "DE"]}
    ai_count = 0
    cache_count = 0

    for idx, row in enumerate(rows, 1):
        q_se = row.get("question_se", "")
        a_se = row.get("answer_se", "")
        serie_hit = None
        hay = (q_se + " " + a_se).lower()
        for serie in valid_formats.keys():
            if serie.lower() in hay:
                serie_hit = serie
                break

        # Först SE->EN
        q_en, src1 = translate_text(q_se, 'EN', serie_hit or '')
        a_en, src2 = translate_text(a_se, 'EN', serie_hit or '')
        out_data['EN'].append([q_en, a_en, 'AI/Cache'])
        
        # Sedan EN->DA och EN->DE baserat på EN-output
        for lang in ['DA','DE']:
            q_trans, _ = translate_text(q_en, lang, serie_hit or '')
            a_trans, _ = translate_text(a_en, lang, serie_hit or '')
            out_data[lang].append([q_trans, a_trans, 'AI/Cache'])
        
        if src1 == 'AI' or src2 == 'AI':
            ai_count += 1
        else:
            cache_count += 1

        print(f"✅ Rad {idx} klar")
            logging.info(f"Rad {idx} klar")
        if idx % 20 == 0:
        logging.info(f"--- Status {idx}/{len(rows)} rader: AI={ai_count}, CACHE={cache_count} ---")
            with open(CACHE_FILE, "w", encoding="utf-8") as f:
                json.dump(cache, f, ensure_ascii=False, indent=2)

    for lang in ["EN", "DA", "DE"]:
        ws = sh.worksheet(FAQ_SHEETS[lang])
        ws.clear()  # SE lämnas orörd
        ws.append_row([f"question_{lang.lower()}", f"answer_{lang.lower()}", "Källa FAQ / AI"])
        ws.append_rows(out_data[lang])

    with open(CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False, indent=2)

    logging.info("🎉 Översättning klar och sparad till Google Sheets")

if __name__ == "__main__":
    process_sheet()
