import os
import time
import json
import sys
from pathlib import Path

import gspread
from dotenv import load_dotenv
from openai import OpenAI

def find_project_root(start: Path, markers=(".env.local", "faq-extended")) -> Path:
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

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
GCP_PROJECT_ID = os.getenv("GCP_PROJECT_ID")
GCP_CLIENT_EMAIL = os.getenv("GCP_CLIENT_EMAIL")
GCP_PRIVATE_KEY = os.getenv("GCP_PRIVATE_KEY")
SHEET_ID_MAIN = os.getenv("SHEET_ID_MAIN")

missing = [k for k,v in {
    "OPENAI_API_KEY": OPENAI_API_KEY,
    "GCP_PROJECT_ID": GCP_PROJECT_ID,
    "GCP_CLIENT_EMAIL": GCP_CLIENT_EMAIL,
    "GCP_PRIVATE_KEY": GCP_PRIVATE_KEY,
    "SHEET_ID_MAIN": SHEET_ID_MAIN,
}.items() if not v]
if missing:
    print(f"❌ Missing env vars in .env.local at {dotenv_path}: {', '.join(missing)}")
    sys.exit(1)

client = OpenAI(api_key=OPENAI_API_KEY)

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

SE_SHEET = "SE_FULL_LOOKUP"
EN_SHEET = "EN_FULL_LOOKUP"
DA_SHEET = "DA_FULL_LOOKUP"
DE_SHEET = "DE_FULL_LOOKUP"

colors_file = ROOT / "faq-extended" / "faq_colors_from_pronto_se_v2.json"
DO_NOT_TRANSLATE = set()
if colors_file.exists():
    try:
        colors_data = json.loads(colors_file.read_text(encoding="utf-8"))
        for item in colors_data:
            q = item.get("question_se", "")
            if "serien" in q:
                serie = q.split("serien")[-1].strip(" ?")
                if serie:
                    DO_NOT_TRANSLATE.add(serie.lower())
            a = item.get("answer_se", "")
            for line in a.split("\n"):
                if line.strip().startswith("-"):
                    color = line.split("(")[0].strip("- ").strip()
                    if color:
                        DO_NOT_TRANSLATE.add(color.lower())
        DO_NOT_TRANSLATE.update({"konjak"})
        print(f"🚫 Protecting {len(DO_NOT_TRANSLATE)} domain words (series & colors)")
    except Exception as e:
        print(f"⚠️ Could not read {colors_file}: {e}")
else:
    print(f"⚠️ {colors_file} not found – continuing without protected list.")

BATCH_SIZE = 20
SLEEP_SECONDS = 2

def translate_with_prompt(prompt: str, text: str) -> str:
    try:
        resp = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt.format(text=text)}],
            temperature=0,
        )
        return resp.choices[0].message.content.strip()
    except Exception as e:
        print(f"❌ Error translating '{text}': {e}")
        return text

PROMPT_DA = """
Du er en oversættelseseekspert inden for byggematerialer, udeklinker, kakel og klinkerdæk.
Brug fagtermer, der er relevante for bygge- og flisebranchen.
Oversæt altid til det ord, som bruges i branchens kataloger og produktblade.
Svar kun med ét ord eller en kort frase, intet andet.

Keyword: "{text}"
"""

PROMPT_DE = """
Du bist ein Übersetzungsexperte für Baustoffe, Außenfliesen, Kacheln und Doppelbodensysteme.
Verwende immer die Fachbegriffe, die in der Bau- und Fliesenbranche verwendet werden.
Übersetze immer in das Wort, das in den Katalogen und Produktblättern der Branche genutzt wird.
Antworte nur mit einem EINZELNEN Wort oder einer kurzen Phrase, nichts weiter.

Keyword: "{text}"
"""

def main():
    ws_se = sh.worksheet(SE_SHEET)
    ws_en = sh.worksheet(EN_SHEET)
    ws_da = sh.worksheet(DA_SHEET)
    ws_de = sh.worksheet(DE_SHEET)

    se_col = ws_se.col_values(1)
    en_col = ws_en.col_values(1)

    total = len(en_col)
    batch_updates = []

    for i, (se, en) in enumerate(zip(se_col, en_col), start=1):
        se_str, en_str = str(se).strip(), str(en).strip()

        if se_str.lower() in DO_NOT_TRANSLATE or en_str.lower() in DO_NOT_TRANSLATE:
            da_new = se_str
            de_new = se_str
            reason = "protected"
        else:
            da_new = translate_with_prompt(PROMPT_DA, en_str)
            de_new = translate_with_prompt(PROMPT_DE, en_str)
            reason = "ai-translate"

        # Write translations in A and log in C
        batch_updates.append({"range": f"{DA_SHEET}!A{i}", "values": [[da_new]]})
        batch_updates.append({"range": f"{DA_SHEET}!C{i}", "values": [[reason]]})

        batch_updates.append({"range": f"{DE_SHEET}!A{i}", "values": [[de_new]]})
        batch_updates.append({"range": f"{DE_SHEET}!C{i}", "values": [[reason]]})

        print(f"✅ Row {i}: EN={en_str} → DA={da_new}, DE={de_new} ({reason})")

        if len(batch_updates) >= BATCH_SIZE * 4:
            body = {"valueInputOption": "USER_ENTERED", "data": list(batch_updates)}
            sh.values_batch_update(body)
            print(f"💾 Saved batch up to row {i}")
            batch_updates.clear()
            time.sleep(SLEEP_SECONDS)

        if i % 50 == 0 or i == total:
            print(f"✅ Progress: {i}/{total}")

    if batch_updates:
        body = {"valueInputOption": "USER_ENTERED", "data": list(batch_updates)}
        sh.values_batch_update(body)
        print("💾 Saved last batch")

    print("🚀 Done!")

if __name__ == "__main__":
    main()
