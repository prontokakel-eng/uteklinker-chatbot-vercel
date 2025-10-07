import os
import time
import json
import sys
from pathlib import Path

import gspread
from dotenv import load_dotenv
from openai import OpenAI

# ---------- Helpers: find project root & .env.local ----------
def find_project_root(start: Path, markers=(".env.local", "faq-extended")) -> Path:
    cur = start.resolve()
    for _ in range(8):
        has_any = any((cur / m).exists() for m in markers)
        if has_any:
            return cur
        cur = cur.parent
    return start.resolve()  # fallback

HERE = Path(__file__).parent
ROOT = find_project_root(HERE)

# Load .env.local from ROOT (works even when running from /tests/.py)
dotenv_path = ROOT / ".env.local"
if dotenv_path.exists():
    load_dotenv(dotenv_path)
else:
    # Also try current working dir as a fallback
    load_dotenv(".env.local")

# ---------- Env & clients ----------
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
    print(f"❌ Saknar env i .env.local på {dotenv_path}: {', '.join(missing)}")
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

# ---------- Load protected words (series/colors) ----------
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
        # Manual exceptions if needed
        DO_NOT_TRANSLATE.update({"konjak"})
        print(f"🚫 Skyddar {len(DO_NOT_TRANSLATE)} domänord (serier & färger) från översättning")
    except Exception as e:
        print(f"⚠️ Kunde inte läsa {colors_file}: {e}")
else:
    print(f"⚠️ Hittade inte {colors_file} – fortsätter utan skyddad lista.")

# ---------- Rules ----------
BATCH_SIZE = 20
SLEEP_SECONDS = 2

def needs_patch(se: str, en: str) -> bool:
    if en is None or str(en).strip() == "":
        return True
    se_l = str(se).strip().lower()
    en_l = str(en).strip().lower()
    if se_l in DO_NOT_TRANSLATE and en_l != se_l:
        return True
    # Heuristics: long or many words -> suspicious
    if len(en_l) > 25 or len(en_l.split()) > 3:
        return True
    return False

def retranslate(se: str) -> str:
    prompt = f"""
Du är en översättningsexpert inom byggmaterial, uteklinker, kakel och klinkerdäck.
Använd facktermer som är relevanta för bygg- och kakelbranschen.
Översätt alltid till det ord som används i branschens kataloger och produktblad.
Svara endast med ETT ord eller en kort fras, inget annat.

Keyword: "{se}"
""".strip()
    try:
        resp = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            temperature=0,
        )
        return resp.choices[0].message.content.strip()
    except Exception as e:
        print(f"❌ Fel vid AI-översättning '{se}': {e}")
        return se

def main():
    ws_se = sh.worksheet(SE_SHEET)
    ws_en = sh.worksheet(EN_SHEET)

    se_col = ws_se.col_values(1)
    en_col = ws_en.col_values(1)

    total = len(se_col)
    patched = protected = retran = 0

    batch_updates = []

    for i, se in enumerate(se_col, start=1):
        en = en_col[i-1] if i-1 < len(en_col) else ""

        if needs_patch(se, en):
            se_str = str(se).strip()
            if se_str.lower() in DO_NOT_TRANSLATE:
                new_val = se_str
                protected += 1
                reason = "protected"
            else:
                new_val = retranslate(se_str)
                retran += 1
                reason = "ai-retranslate"

            batch_updates.append({
                "range": f"{EN_SHEET}!A{i}",
                "values": [[new_val]],
            })
            patched += 1
            print(f"✅ Patched rad {i}: {se_str} -> {new_val} ({reason})")

        # Flush in controlled batches
        if len(batch_updates) >= BATCH_SIZE:
            body = {"valueInputOption": "USER_ENTERED", "data": list(batch_updates)}
            sh.values_batch_update(body)
            print(f"💾 Sparade batch upp till rad {i}")
            batch_updates.clear()
            time.sleep(SLEEP_SECONDS)

        # Progress
        if i % 50 == 0 or i == total:
            print(f"✅ EN progress: {i}/{total}")

    # Final flush
    if batch_updates:
        body = {"valueInputOption": "USER_ENTERED", "data": list(batch_updates)}
        sh.values_batch_update(body)
        print("💾 Sparade sista batchen")

    print("🚀 Klar!")
    print(f"Totals: patched={patched}, protected={protected}, retranslated={retran}")

if __name__ == "__main__":
    main()
