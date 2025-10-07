import os
import time
import pandas as pd
from openai import OpenAI

# ================== KONFIG ==================
INPUT_FILE = "backup_step2_row400_20250917_155826.xlsx"  # din “mest kompletta” backup
OUTPUT_DIR = "översättning"
OUTPUT_FILE = os.path.join(OUTPUT_DIR, "faq_golden_translated.xlsx")
CHECKPOINT_FILE = "progress_missing_checkpoint.txt"

MODEL = "gpt-4o"   # hög kvalitet; byt till "gpt-4o-mini" om du vill spara kostnad
SLEEP_SE_EN = 0.8  # pauser för rate limit
SLEEP_EN_X  = 1.0

# Kolumnnamn (måste matcha filen)
COLS = ["question", "answer", "source", "verified"]
SHEETS = ["FAQ_SE", "FAQ_EN", "FAQ_DA", "FAQ_DE"]
# ============================================

client = OpenAI(api_key=os.environ.get("OPENAI_API_KEY"))

def ensure_dir(d):
    if not os.path.exists(d):
        os.makedirs(d, exist_ok=True)

def safe_get(df, i, col):
    try:
        v = df.at[i, col]
        if pd.isna(v):
            return ""
        return str(v)
    except Exception:
        return ""

def translate_text(text, source_lang, target_lang, sleep_s=0.8):
    text = (text or "").strip()
    if not text:
        return text
    for attempt in range(3):
        try:
            resp = client.chat.completions.create(
                model=MODEL,
                messages=[
                    {"role": "system", "content": f"You are a professional translator. Translate from {source_lang} to {target_lang}. Keep formatting, keep units, be concise and correct domain-specific terminology."},
                    {"role": "user", "content": text},
                ],
                temperature=0.2
            )
            out = resp.choices[0].message.content.strip()
            time.sleep(sleep_s)
            return out
        except Exception as e:
            print(f"⚠️ Retry {attempt+1}/3 {source_lang}->{target_lang}: {e}")
            time.sleep(2 + attempt)
    return text  # fallback, lämna original om det skiter sig

def main():
    ensure_dir(OUTPUT_DIR)
    print(f"📂 Läser in {INPUT_FILE} ...")
    df_dict = pd.read_excel(INPUT_FILE, sheet_name=None)

    # Säkerställ att alla flikar finns
    for sh in SHEETS:
        if sh not in df_dict:
            df_dict[sh] = pd.DataFrame(columns=COLS)

    df_se = df_dict["FAQ_SE"].copy()
    df_en = df_dict["FAQ_EN"].copy()
    df_da = df_dict["FAQ_DA"].copy()
    df_de = df_dict["FAQ_DE"].copy()

    # Säkerställ samma längd som SE
    n = len(df_se)
    for df in [df_en, df_da, df_de]:
        if len(df) < n:
            # fyll upp tomma rader
            missing = n - len(df)
            df_add = pd.DataFrame([[None]*len(COLS)] * missing, columns=COLS)
            df = pd.concat([df, df_add], ignore_index=True)
        # trunka om för lång (borde ej hända)
        if len(df) > n:
            df.drop(index=range(n, len(df)), inplace=True)
        # skriv tillbaka
        if df is df_en:
            df_en = df
        elif df is df_da:
            df_da = df
        else:
            df_de = df

    # Slå ihop i dict igen
    df_dict["FAQ_SE"] = df_se
    df_dict["FAQ_EN"] = df_en
    df_dict["FAQ_DA"] = df_da
    df_dict["FAQ_DE"] = df_de

    # Resume från checkpoint
    start_i = 0
    if os.path.exists(CHECKPOINT_FILE):
        try:
            start_i = int(open(CHECKPOINT_FILE, "r", encoding="utf-8").read().strip() or 0)
            print(f"⏩ Fortsätter från rad {start_i+1}")
        except:
            pass

    # Cacher för att undvika identisk svar-översättning flera gånger
    map_en = {}  # se_answer -> en_answer
    map_da = {}  # en_answer -> da_answer
    map_de = {}  # en_answer -> de_answer

    # Räkna hur många som faktiskt saknas
    missing_rows = []
    for i in range(start_i, n):
        a_da = safe_get(df_da, i, "answer")
        a_de = safe_get(df_de, i, "answer")
        if not a_da.strip() or a_da.strip().upper() == "[MISSING]":
            missing_rows.append(i)
        elif not a_de.strip() or a_de.strip().upper() == "[MISSING]":
            missing_rows.append(i)
    missing_rows = sorted(set(missing_rows))

    print(f"🔎 Totalt saknade rader att fylla: {len(missing_rows)}")

    for idx, i in enumerate(missing_rows, start=1):
        q_se = safe_get(df_se, i, "question")
        a_se = safe_get(df_se, i, "answer")
        q_en = safe_get(df_en, i, "question")
        a_en = safe_get(df_en, i, "answer")

        print(f"\n[{idx}/{len(missing_rows)}] Rad {i+1}")

        # Steg 1: SE -> EN om EN saknas
        if not q_en.strip():
            q_en = translate_text(q_se, "Swedish", "English", sleep_s=SLEEP_SE_EN)
            df_en.at[i, "question"] = q_en or q_se
        if not a_en.strip():
            if a_se in map_en:
                a_en = map_en[a_se]
            else:
                a_en = translate_text(a_se, "Swedish", "English", sleep_s=SLEEP_SE_EN)
                map_en[a_se] = a_en
            df_en.at[i, "answer"] = a_en
            df_en.at[i, "source"] = "translated"
            df_en.at[i, "verified"] = "FALSE"

        # Steg 2: EN -> DA / DE om saknas
        # DA
        a_da = safe_get(df_da, i, "answer")
        if not a_da.strip() or a_da.strip().upper() == "[MISSING]":
            if a_en in map_da:
                da_answer = map_da[a_en]
            else:
                da_answer = translate_text(a_en, "English", "Danish", sleep_s=SLEEP_EN_X)
                map_da[a_en] = da_answer
            # fråga också
            da_question = translate_text(q_en, "English", "Danish", sleep_s=SLEEP_EN_X) if not safe_get(df_da, i, "question").strip() else safe_get(df_da, i, "question")
            df_da.at[i, "question"] = da_question
            df_da.at[i, "answer"]   = da_answer
            df_da.at[i, "source"]   = "translated"
            df_da.at[i, "verified"] = "FALSE"

        # DE
        a_de = safe_get(df_de, i, "answer")
        if not a_de.strip() or a_de.strip().upper() == "[MISSING]":
            if a_en in map_de:
                de_answer = map_de[a_en]
            else:
                de_answer = translate_text(a_en, "English", "German", sleep_s=SLEEP_EN_X)
                map_de[a_en] = de_answer
            de_question = translate_text(q_en, "English", "German", sleep_s=SLEEP_EN_X) if not safe_get(df_de, i, "question").strip() else safe_get(df_de, i, "question")
            df_de.at[i, "question"] = de_question
            df_de.at[i, "answer"]   = de_answer
            df_de.at[i, "source"]   = "translated"
            df_de.at[i, "verified"] = "FALSE"

        # Checkpoint & backup var 25:e rad (snabbare återhämtning)
        if (idx % 25) == 0 or idx == len(missing_rows):
            with open(CHECKPOINT_FILE, "w", encoding="utf-8") as f:
                f.write(str(i+1))
            backup = os.path.join(OUTPUT_DIR, f"backup_missing_row{i+1}.xlsx")
            with pd.ExcelWriter(backup, engine="openpyxl") as w:
                df_se.to_excel(w, sheet_name="FAQ_SE", index=False)
                df_en.to_excel(w, sheet_name="FAQ_EN", index=False)
                df_da.to_excel(w, sheet_name="FAQ_DA", index=False)
                df_de.to_excel(w, sheet_name="FAQ_DE", index=False)
            print(f"💾 Backup: {backup}")

    # Spara slutfil
    with pd.ExcelWriter(OUTPUT_FILE, engine="openpyxl") as w:
        df_se.to_excel(w, sheet_name="FAQ_SE", index=False)
        df_en.to_excel(w, sheet_name="FAQ_EN", index=False)
        df_da.to_excel(w, sheet_name="FAQ_DA", index=False)
        df_de.to_excel(w, sheet_name="FAQ_DE", index=False)

    print(f"\n🎉 Klart! Sparade {OUTPUT_FILE}")

if __name__ == "__main__":
    main()
