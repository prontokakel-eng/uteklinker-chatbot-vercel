import pandas as pd
from openai import OpenAI
import time
import os
from datetime import datetime

client = OpenAI()  # API-nyckel via $env:OPENAI_API_KEY

# Mappar och filnamn
output_dir = "översättning"
os.makedirs(output_dir, exist_ok=True)

input_file = "Faq med 553 frågor och svar SE DA EN DE.xlsx"
output_file = os.path.join(output_dir, "faq_pivot_full_gpt4o.xlsx")
checkpoint_file = os.path.join(output_dir, "progress_checkpoint.txt")
log_file = os.path.join(output_dir, "translation_log.txt")

# Initiera logg
def log(msg):
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    with open(log_file, "a", encoding="utf-8") as f:
        f.write(f"[{timestamp}] {msg}\n")
    print(msg)

# Ladda Excel
df_dict = pd.read_excel(input_file, sheet_name=None)

faq_se_orig = df_dict["FAQ_SE"].copy()
faq_en = df_dict["FAQ_EN"].copy()
faq_da = df_dict["FAQ_DA"].copy()
faq_de = df_dict["FAQ_DE"].copy()

total_rows = len(faq_se_orig)

# Resume: Läs checkpoint
start_row = 0
if os.path.exists(checkpoint_file):
    with open(checkpoint_file, "r") as f:
        start_row = int(f.read().strip())
    log(f"⏩ Fortsätter från rad {start_row+1}/{total_rows}")
else:
    log(f"🚀 Startar ny översättning av {total_rows} rader (SE → EN → DA/DE) med gpt-4o")

# --- Steg 1: SE → EN ---
translation_map_en = {}

for idx, row in faq_se_orig.iloc[start_row:].iterrows():
    q_se, a_se = row["question_se"], row["answer_se"]

    log(f"[SE→EN] Rad {idx+1}/{total_rows}")
    try:
        resp_q = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": f"Translate this Swedish question into English:\n\n{q_se}"}],
        )
        q_en = resp_q.choices[0].message.content.strip()

        if a_se not in translation_map_en:
            resp_a = client.chat.completions.create(
                model="gpt-4o",
                messages=[{"role": "user", "content": f"Translate this Swedish answer into English:\n\n{a_se}"}],
            )
            translation_map_en[a_se] = resp_a.choices[0].message.content.strip()

        a_en = translation_map_en[a_se]

        faq_en.loc[idx, "question_en"] = q_en
        faq_en.loc[idx, "answer_en"] = a_en
        faq_en.loc[idx, "AutoTranslated"] = True
        log(f"✅ SE→EN klar rad {idx+1}")
    except Exception as e:
        log(f"⚠️ Fel vid rad {idx+1}: {e}")
        time.sleep(2)

    # Checkpoint
    with open(checkpoint_file, "w") as f:
        f.write(str(idx))

    # Backup var 50:e rad
    if (idx + 1) % 50 == 0:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_file = os.path.join(output_dir, f"backup_step1_row{idx+1}_{timestamp}.xlsx")
        with pd.ExcelWriter(backup_file, engine="openpyxl") as writer:
            faq_se_orig.to_excel(writer, "FAQ_SE", index=False)
            faq_en.to_excel(writer, "FAQ_EN", index=False)
            faq_da.to_excel(writer, "FAQ_DA", index=False)
            faq_de.to_excel(writer, "FAQ_DE", index=False)
        log(f"💾 Backup sparad: {backup_file}")

    time.sleep(1.2)

# --- Steg 2: EN → DA och DE ---
translation_map_da, translation_map_de = {}, {}

for idx, row in faq_en.iloc[start_row:].iterrows():
    q_en, a_en = row["question_en"], row["answer_en"]

    log(f"[EN→DA/DE] Rad {idx+1}/{total_rows}")
    try:
        resp_da_q = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": f"Translate this English question into Danish:\n\n{q_en}"}],
        )
        q_da = resp_da_q.choices[0].message.content.strip()

        resp_de_q = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": f"Translate this English question into German:\n\n{q_en}"}],
        )
        q_de = resp_de_q.choices[0].message.content.strip()

        if a_en not in translation_map_da:
            resp_da_a = client.chat.completions.create(
                model="gpt-4o",
                messages=[{"role": "user", "content": f"Translate this English answer into Danish:\n\n{a_en}"}],
            )
            translation_map_da[a_en] = resp_da_a.choices[0].message.content.strip()

        if a_en not in translation_map_de:
            resp_de_a = client.chat.completions.create(
                model="gpt-4o",
                messages=[{"role": "user", "content": f"Translate this English answer into German:\n\n{a_en}"}],
            )
            translation_map_de[a_en] = resp_de_a.choices[0].message.content.strip()

        faq_da.loc[idx, "question_da"] = q_da
        faq_da.loc[idx, "answer_da"] = translation_map_da[a_en]
        faq_da.loc[idx, "AutoTranslated"] = True

        faq_de.loc[idx, "question_de"] = q_de
        faq_de.loc[idx, "answer_de"] = translation_map_de[a_en]
        faq_de.loc[idx, "AutoTranslated"] = True
        log(f"✅ EN→DA/DE klar rad {idx+1}")
    except Exception as e:
        log(f"⚠️ Fel vid rad {idx+1}: {e}")
        time.sleep(5)

    # Checkpoint
    with open(checkpoint_file, "w") as f:
        f.write(str(idx))

    # Backup var 50:e rad
    if (idx + 1) % 50 == 0:
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        backup_file = os.path.join(output_dir, f"backup_step2_row{idx+1}_{timestamp}.xlsx")
        with pd.ExcelWriter(backup_file, engine="openpyxl") as writer:
            faq_se_orig.to_excel(writer, "FAQ_SE", index=False)
            faq_en.to_excel(writer, "FAQ_EN", index=False)
            faq_da.to_excel(writer, "FAQ_DA", index=False)
            faq_de.to_excel(writer, "FAQ_DE", index=False)
        log(f"💾 Backup sparad: {backup_file}")

    time.sleep(1.5)

# --- Spara slutfil ---
with pd.ExcelWriter(output_file, engine="openpyxl") as writer:
    faq_se_orig.to_excel(writer, "FAQ_SE", index=False)
    faq_en.to_excel(writer, "FAQ_EN", index=False)
    faq_da.to_excel(writer, "FAQ_DA", index=False)
    faq_de.to_excel(writer, "FAQ_DE", index=False)

log(f"✅ Klar! Fil sparad som {output_file}")
log("📝 Checkpoint-fil raderad (fullt klart).")
os.remove(checkpoint_file)
