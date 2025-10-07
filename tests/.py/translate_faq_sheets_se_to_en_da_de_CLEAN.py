import os
import json
import gspread
import logging
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

# 📂 Cache & Logg
CACHE_FILE = "faq-extended/cache/faq_translate.json"
LOG_FILE = "faq-extended/logg/translate_run.log"

os.makedirs("faq-extended/cache", exist_ok=True)
os.makedirs("faq-extended/logg", exist_ok=True)

logging.basicConfig(filename=LOG_FILE, level=logging.INFO, format="%(asctime)s %(message)s")

if os.path.exists(CACHE_FILE):
    with open(CACHE_FILE, "r", encoding="utf-8") as f:
        try:
            cache = json.load(f)
        except Exception:
            cache = {}
else:
    cache = {}

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

FAQ_SHEETS = {"SE": "FAQ_SE", "EN": "FAQ_EN", "DA": "FAQ_DA", "DE": "FAQ_DE"}

LANG_PROMPTS = {
    "EN": "Translate the following FAQ (question and answer) from Swedish to English. Do not summarize or shorten. Always include the full list of items exactly as in the source. Keep series names, colors, and formats unchanged.",
    "DA": "Oversæt følgende FAQ (spørgsmål og svar) til dansk. Du må ikke opsummere eller afkorte. Medtag altid hele listen nøjagtigt som i kilden. Behold serienavne, farver og formater uændrede.",
    "DE": "Übersetzen Sie die folgende FAQ (Frage und Antwort) ins Deutsche. Nicht zusammenfassen oder kürzen. Immer die vollständige Liste wie in der Quelle übernehmen. Seriennamen, Farben und Formate unverändert lassen."
}

def is_swedish(text: str) -> bool:
    sw = ["är","och","inte","eller","plattor","ytan","mycket","finns","vilka","hur","påverkas","kan","säker","halk"]
    return sum(1 for w in sw if w in text.lower()) >= 2

def translate_text(text: str, target_lang: str):
    key = f"{target_lang}::{text.strip()}"
    if key in cache:
        logging.info(f"[CACHE] {target_lang} :: {text[:60]}...")
        return cache[key], "CACHE"

    prompt = f"""Translate the following from Swedish to {target_lang}.
Do not summarize or shorten. Always output the full list of items as in the source.
Always output in {target_lang}. Keep series names, colors, and formats unchanged:

{text}"""
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
        logging.info(f"⚠️ Svenska detekterad i {target_lang}-output, kör om striktare...")
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

        # Först SE->EN
        q_en, src1 = translate_text(q_se, "EN")
        a_en, src2 = translate_text(a_se, "EN")
        out_data["EN"].append([q_en, a_en, "AI/Cache"])

        # Sedan EN->DA och EN->DE baserat på EN-output
        for lang in ["DA", "DE"]:
            q_trans, _ = translate_text(q_en, lang)
            a_trans, _ = translate_text(a_en, lang)
            out_data[lang].append([q_trans, a_trans, "AI/Cache"])

        if src1 == "AI" or src2 == "AI":
            ai_count += 1
        else:
            cache_count += 1

        print(f"✅ Rad {idx} klar")
        logging.info(f"Rad {idx} klar")

        # ✨ Skriv till Google Sheets var 5:e rad
        if idx % 5 == 0:
            for lang in ["EN", "DA", "DE"]:
                ws = sh.worksheet(FAQ_SHEETS[lang])
                if idx == 5:  # rensa första gången
                    ws.clear()
                    ws.append_row([f"question_{lang.lower()}", f"answer_{lang.lower()}", "Källa FAQ / AI"])
                ws.append_rows(out_data[lang])
                out_data[lang] = []  # töm buffert
            logging.info(f"--- Mellanlagring {idx} rader --- AI={ai_count}, CACHE={cache_count}")

    # Skriv resterande översättningar i slutet
    for lang in ["EN", "DA", "DE"]:
        if out_data[lang]:
            ws = sh.worksheet(FAQ_SHEETS[lang])
            if len(rows) <= 5:  # om inga rubriker skrivits innan
                ws.clear()
                ws.append_row([f"question_{lang.lower()}", f"answer_{lang.lower()}", "Källa FAQ / AI"])
            ws.append_rows(out_data[lang])

    with open(CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False, indent=2)

    print("🎉 Översättning klar och sparad till Google Sheets")

if __name__ == "__main__":
    process_sheet()
