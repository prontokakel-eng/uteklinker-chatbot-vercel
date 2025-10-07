import os
import pandas as pd
from openai import OpenAI

# Initiera OpenAI-klienten
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

INPUT_FILE = "Faq med 553 frågor och svar SE DA EN DE.xlsx"
RESUME_FILE = "översättning/resume_test.txt"

LANG_NAMES = {
    "EN": "English",
    "DA": "Danish",
    "DE": "German"
}

def safe_translate(text, src_lang, tgt_lang, row_idx, col_name):
    """Skicka text till OpenAI och översätt säkert."""
    if not isinstance(text, str) or text.strip() == "":
        return text
    try:
        prompt = (
            f"Translate the following text from {src_lang} to {tgt_lang}. "
            f"Use concise, professional, domain-specific wording:\n\n{text}"
        )
        resp = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            temperature=0
        )
        return resp.choices[0].message.content.strip()
    except Exception as e:
        with open(RESUME_FILE, "a", encoding="utf-8") as f:
            f.write(f"❌ Row {row_idx}, col {col_name}: {e}\n")
        return text

def main():
    print(f"📂 Reading {INPUT_FILE} ...")
    xls = pd.ExcelFile(INPUT_FILE)
    df_se = pd.read_excel(xls, sheet_name="FAQ_SE")
    df_se = df_se.dropna(how="all", axis=1).dropna(how="all", axis=0)

    # Ta bara de första 5 raderna
    df_se = df_se.head(5)

    for i in range(len(df_se)):
        se_q = df_se.iloc[i]["question_se"]
        se_a = df_se.iloc[i]["answer_se"]

        print(f"\n=== Q{i+1} ===")
        print(f"SE Q: {se_q}")
        print(f"SE A: {se_a}")

        # SE -> EN
        en_q = safe_translate(se_q, "Swedish", LANG_NAMES["EN"], i+1, "question_en")
        en_a = safe_translate(se_a, "Swedish", LANG_NAMES["EN"], i+1, "answer_en")
        print(f"EN Q: {en_q}")
        print(f"EN A: {en_a}")

        # EN -> DA
        da_q = safe_translate(en_q, "English", LANG_NAMES["DA"], i+1, "question_da")
        da_a = safe_translate(en_a, "English", LANG_NAMES["DA"], i+1, "answer_da")
        print(f"DA Q: {da_q}")
        print(f"DA A: {da_a}")

        # EN -> DE
        de_q = safe_translate(en_q, "English", LANG_NAMES["DE"], i+1, "question_de")
        de_a = safe_translate(en_a, "English", LANG_NAMES["DE"], i+1, "answer_de")
        print(f"DE Q: {de_q}")
        print(f"DE A: {de_a}")

if __name__ == "__main__":
    main()
