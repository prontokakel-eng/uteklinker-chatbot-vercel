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
CACHE_FILE = ".cache_faq_translate_merged.json"
if os.path.exists(CACHE_FILE):
    with open(CACHE_FILE, "r", encoding="utf-8") as f:
        cache = json.load(f)
else:
    cache = {}

# 📂 Facit med giltiga format
with open("faq-extended/valid_formats_by_series.cleaned.json", "r", encoding="utf-8") as f:
    valid_formats = json.load(f)

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

FAQ_SHEETS = {
    "SE": "FAQ_SE",
    "EN": "FAQ_EN",
    "DA": "FAQ_DA",
    "DE": "FAQ_DE"
}

LANG_PROMPTS = {
    "EN": "Translate the following FAQ (question and answer) from Swedish to English. Keep series names, colors, and formats unchanged if they exist.",
    "DA": "Oversæt følgende FAQ (spørgsmål og svar) fra svensk til dansk. Behold serienavne, farver og formater uændrede, hvis de findes.",
    "DE": "Übersetzen Sie die folgende FAQ (Frage und Antwort) vom Schwedischen ins Deutsche. Seriennamen, Farben und Formate unverändert lassen, falls vorhanden."
}

def normalize_formats(text: str, serie: str):
    if not isinstance(text, str):
        return text
    if not serie or serie not in valid_formats:
        return text

    # Alla giltiga format för serien
    valid_set = set()
    for color, formats in valid_formats[serie].items():
        valid_set.update(formats)

    # 1️⃣ Ta bort format som inte finns i whitelist
    def repl(m):
        found = m.group(1)
        return found if found in valid_set else ""
    text = re.sub(r"(\d{1,3}(?:,\d{1,2})?x\d{1,3}(?:,\d{1,2})?cm)", repl, text)

    # 2️⃣ Säkerställ att giltiga format finns omnämnda
    if not any(f in text for f in valid_set):
        text += f"\nTillgängliga format: {', '.join(sorted(valid_set))}"

    # 📜 Logga till CMD
    print(f"      ↪ Normaliserade format för serie '{serie}': {', '.join(sorted(valid_set))}")

    return text

def is_swedish(text: str):
    """Enkel heuristik för att avgöra om texten fortfarande är svenska"""
    swedish_markers = ["är", "och", "inte", "eller", "plattor", "ytan", "mycket", "finns", "vilka"]
    count = sum(1 for m in swedish_markers if m in text.lower())
    return count >= 2  # om minst 2 vanliga svenska ord finns, troligen svensk text

def translate_text(text, target_lang, serie):
    key = f"{target_lang}::{text.strip()}"
    if key in cache:
        print(f"   ↪ [CACHE] {target_lang} :: {text[:60]}...")
        return cache[key], "CACHE"

    # Första försök
    prompt = f"Translate the following from Swedish to {target_lang}. Always output in {target_lang}. Keep series names, colors, and formats unchanged:\n\n{text}"
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": LANG_PROMPTS[target_lang]},
            {"role": "user", "content": prompt}
        ],
        temperature=0.2
    )
    translated = resp.choices[0].message.content.strip()

    # Efterkontroll: om fortfarande svenska → kör om striktare
    if is_swedish(translated):
        print(f"      ⚠️ Detekterade svenska i {target_lang}-output, kör om striktare...")
        strict_prompt = f"The following text is in Swedish. You must output only in {target_lang}. Do not output Swedish. Keep product series names, colors, and formats unchanged:\n\n{text}"
        resp2 = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[
                {"role": "system", "content": LANG_PROMPTS[target_lang]},
                {"role": "user", "content": strict_prompt}
            ],
            temperature=0.0
        )
        translated = resp2.choices[0].message.content.strip()

    # Normalisera formaten efter översättning
    translated = normalize_formats(translated, serie)

    cache[key] = translated
    print(f"   ↪ [AI] {target_lang} :: {text[:60]}...")
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
        for serie in valid_formats.keys():
            if serie.lower() in (q_se + " " + a_se).lower():
                serie_hit = serie
                break

        for lang in ["EN", "DA", "DE"]:
            q_trans, src1 = translate_text(q_se, lang, serie_hit or "")
            a_trans, src2 = translate_text(a_se, lang, serie_hit or "")

            out_data[lang].append([q_trans, a_trans, "AI/Cache"])

            if src1 == "AI" or src2 == "AI":
                ai_count += 1
            else:
                cache_count += 1

        print(f"✅ Rad {idx} klar")

        if idx % 20 == 0:
            print(f"--- Status {idx}/{len(rows)} rader: AI={ai_count}, CACHE={cache_count} ---")
            with open(CACHE_FILE, "w", encoding="utf-8") as f:
                json.dump(cache, f, ensure_ascii=False, indent=2)

    # ✍️ Skriv tillbaka
    for lang in ["EN", "DA", "DE"]:
        ws = sh.worksheet(FAQ_SHEETS[lang])
        ws.clear()
        ws.append_row(["question_" + lang.lower(), "answer_" + lang.lower(), "Källa FAQ / AI"])
        ws.append_rows(out_data[lang])

    with open(CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False, indent=2)

    print("🎉 Översättning klar och sparad till Google Sheets")

def main():
    process_sheet()

if __name__ == "__main__":
    main()
