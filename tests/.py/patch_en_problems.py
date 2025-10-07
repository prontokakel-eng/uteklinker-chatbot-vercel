import os
import time
import json
import gspread
from dotenv import load_dotenv
from openai import OpenAI

# Load env vars
load_dotenv(".env.local")
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

SE_SHEET = "SE_FULL_LOOKUP"
EN_SHEET = "EN_FULL_LOOKUP"

# Load protected words from JSON
colors_file = os.path.join("faq-extended", "faq_colors_from_pronto_se_v2.json")
DO_NOT_TRANSLATE = set()
try:
    with open(colors_file, encoding="utf-8") as f:
        colors_data = json.load(f)
    for item in colors_data:
        q = item.get("question_se", "")
        if "serien" in q:
            serie = q.split("serien")[-1].strip(" ?")
            if serie:
                DO_NOT_TRANSLATE.add(serie.lower())
        a = item.get("answer_se", "")
        for line in a.split("\\n"):
            if line.strip().startswith("-"):
                color = line.split("(")[0].strip("- ").strip()
                if color:
                    DO_NOT_TRANSLATE.add(color.lower())
    # Add manual exceptions
    DO_NOT_TRANSLATE.update({"konjak"})
except FileNotFoundError:
    print("⚠️ Colors/series JSON not found")

def needs_patch(se, en):
    if not en or str(en).strip() == "":
        return True
    if se.lower() in DO_NOT_TRANSLATE and en.lower() != se.lower():
        return True
    if len(en) > 25 or len(en.split()) > 3:
        return True
    return False

def retranslate(se):
    prompt = f"""
Du är en översättningsexpert inom byggmaterial, uteklinker, kakel och klinkerdäck.
Använd facktermer som är relevanta för bygg- och kakelbranschen.
Översätt alltid till det ord som används i branschens kataloger och produktblad.
Svara endast med ETT ord eller en kort fras, inget annat.

Keyword: "{se}"
"""
    try:
        resp = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt.strip()}],
            temperature=0
        )
        return resp.choices[0].message.content.strip()
    except Exception as e:
        print(f"❌ Error when retranslating '{se}': {e}")
        return se

def main():
    ws_se = sh.worksheet(SE_SHEET)
    ws_en = sh.worksheet(EN_SHEET)

    se_col = ws_se.col_values(1)
    en_col = ws_en.col_values(1)

    total = len(se_col)
    patched = 0
    protected = 0
    retran = 0

    batch_updates = []

    for i, se in enumerate(se_col, start=1):
        if i > len(en_col):
            en = ""
        else:
            en = en_col[i-1]

        if needs_patch(se, en):
            if se.lower() in DO_NOT_TRANSLATE:
                new_val = se
                protected += 1
                reason = "protected"
            else:
                new_val = retranslate(se)
                retran += 1
                reason = "ai-retranslate"

            batch_updates.append({
                "range": f"{EN_SHEET}!A{i}",
                "values": [[new_val]]
            })
            patched += 1
            print(f"✅ Patched rad {i}: {se} -> {new_val} ({reason})")

        # Flush every 20 updates
        if len(batch_updates) >= 20:
            body = {"valueInputOption": "USER_ENTERED", "data": batch_updates}
            sh.values_batch_update(body)
            print(f"💾 Sparade batch upp till rad {i}")
            batch_updates.clear()
            time.sleep(2)

    # Final flush
    if batch_updates:
        body = {"valueInputOption": "USER_ENTERED", "data": batch_updates}
        sh.values_batch_update(body)
        print("💾 Sparade sista batchen")

    print("🚀 Klar!")
    print(f"Totals: patched={patched}, protected={protected}, retranslated={retran}")

if __name__ == "__main__":
    main()
