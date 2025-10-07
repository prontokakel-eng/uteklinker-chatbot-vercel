import pandas as pd
import os
import re
from openai import OpenAI

INPUT_FILE = "Faq med 553 frågor och svar SE DA EN DE.xlsx"
OUTPUT_FILE = "Faq_med_553_faq_cleaned.xlsx"
LOG_FILE = "shorten_log.txt"

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Fixar produktnamn
def fix_product_names(text):
    if not isinstance(text, str):
        return text
    return (text
            .replace("KlinkerDeck", "Klinkerdäck®")
            .replace("Klinkerdeck", "Klinkerdäck®"))

# Smart förkortning med OpenAI
def smart_shorten(text, lang="English", max_len=250, sheet=None, row=None, col=None):
    if not isinstance(text, str):
        return text
    if len(text) <= max_len:
        return text
    try:
        prompt = (
            f"Shorten the following {lang} text to no more than two sentences, "
            f"while preserving the full meaning and keeping a professional, domain-specific tone:\n\n{text}"
        )
        resp = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            temperature=0
        )
        shortened = resp.choices[0].message.content.strip()

        # Logga förkortningen
        with open(LOG_FILE, "a", encoding="utf-8") as f:
            f.write(f"[{sheet}] Row {row}, col {col}, orig_len={len(text)}\n")

        return shortened
    except Exception as e:
        print(f"⚠️ Could not shorten text in {sheet} row {row}, col {col}: {e}")
        return text  # fallback

def main():
    xls = pd.ExcelFile(INPUT_FILE)
    sheets = xls.sheet_names

    # Rensa loggfil
    if os.path.exists(LOG_FILE):
        os.remove(LOG_FILE)

    results = {}
    for sheet in sheets:
        df = pd.read_excel(xls, sheet_name=sheet)

        # Bestäm språk för prompten
        if sheet == "FAQ_SE":
            lang = "Swedish"
        elif sheet == "FAQ_EN":
            lang = "English"
        elif sheet == "FAQ_DA":
            lang = "Danish"
        elif sheet == "FAQ_DE":
            lang = "German"
        else:
            lang = "English"

        # Kör fixar
        for col in df.columns:
            for i in range(len(df)):
                text = df.at[i, col]
                text = fix_product_names(text)
                text = smart_shorten(text, lang=lang, sheet=sheet, row=i+1, col=col)
                df.at[i, col] = text

        results[sheet] = df

    # Spara ny fil
    with pd.ExcelWriter(OUTPUT_FILE, engine="openpyxl") as writer:
        for sheet, df in results.items():
            df.to_excel(writer, sheet_name=sheet, index=False)

    print(f"🎉 Klar! Sparade till {OUTPUT_FILE}")
    print(f"📜 Logg över förkortade texter finns i {LOG_FILE}")

if __name__ == "__main__":
    main()
