import pandas as pd
import re
import os

INPUT_FILE = "Faq med 553 frågor och svar SE DA EN DE.xlsx"
OUTPUT_FILE = "Faq_med_553_faq_cleaned.xlsx"

# Funktion för att fixa produktnamn
def fix_product_names(text):
    if not isinstance(text, str):
        return text
    return (text
            .replace("KlinkerDeck", "Klinkerdäck®")
            .replace("Klinkerdeck", "Klinkerdäck®"))

# Funktion för att korta ner långa texter
def shorten_text(text, max_len=250):
    if not isinstance(text, str):
        return text
    if len(text) <= max_len:
        return text
    # Dela på punkter
    sentences = re.split(r'(?<=[.!?]) +', text)
    shortened = " ".join(sentences[:2])  # Ta de 2 första meningarna
    return shortened

def main():
    xls = pd.ExcelFile(INPUT_FILE)
    sheets = xls.sheet_names

    results = {}
    for sheet in sheets:
        df = pd.read_excel(xls, sheet_name=sheet)

        # Endast översatta språk
        if sheet in ["FAQ_EN", "FAQ_DA", "FAQ_DE"]:
            for col in df.columns:
                df[col] = df[col].apply(fix_product_names)
                df[col] = df[col].apply(shorten_text)

        results[sheet] = df

    # Spara till ny fil
    with pd.ExcelWriter(OUTPUT_FILE, engine="openpyxl") as writer:
        for sheet, df in results.items():
            df.to_excel(writer, sheet_name=sheet, index=False)

    print(f"🎉 Klar! Sparade till {OUTPUT_FILE}")

if __name__ == "__main__":
    main()
