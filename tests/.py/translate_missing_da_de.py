# translate_missing_da_de.py
import os
import time
import pandas as pd
from openai import OpenAI

client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

input_file = "översättning/faq_golden_translated.xlsx"
output_file = "översättning/faq_golden_translated_full.xlsx"

def translate_text(text, target_lang):
    if not text or not text.strip():
        return text
    try:
        response = client.chat.completions.create(
            model="gpt-4o-mini",  # eller gpt-4o om du vill ha ännu bättre
            messages=[
                {"role": "system", "content": f"Översätt texten till {target_lang}."},
                {"role": "user", "content": text},
            ],
            temperature=0.2,
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        print(f"⚠️ Fel vid översättning: {e}")
        return text

# Läs in Excel
xls = pd.ExcelFile(input_file)
df_se = pd.read_excel(xls, "FAQ_SE")
df_en = pd.read_excel(xls, "FAQ_EN")
df_da = pd.read_excel(xls, "FAQ_DA")
df_de = pd.read_excel(xls, "FAQ_DE")

print(f"📊 Rader i SE: {len(df_se)} | EN: {len(df_en)} | DA: {len(df_da)} | DE: {len(df_de)}")

# Kopiera för säkerhet
df_da_out, df_de_out = df_da.copy(), df_de.copy()

# Fyll DA/DE där tomt
for i in range(len(df_en)):
    en_q, en_a = str(df_en.iloc[i, 0]), str(df_en.iloc[i, 1])

    # DA
    if i >= len(df_da_out) or pd.isna(df_da_out.iloc[i, 0]) or not str(df_da_out.iloc[i, 0]).strip():
        trans_q = translate_text(en_q, "danska")
        trans_a = translate_text(en_a, "danska")
        if i >= len(df_da_out):
            df_da_out.loc[i] = [trans_q, trans_a]
        else:
            df_da_out.iloc[i, 0] = trans_q
            df_da_out.iloc[i, 1] = trans_a
        print(f"✅ [DA] Rad {i+1} klar")

    # DE
    if i >= len(df_de_out) or pd.isna(df_de_out.iloc[i, 0]) or not str(df_de_out.iloc[i, 0]).strip():
        trans_q = translate_text(en_q, "tyska")
        trans_a = translate_text(en_a, "tyska")
        if i >= len(df_de_out):
            df_de_out.loc[i] = [trans_q, trans_a]
        else:
            df_de_out.iloc[i, 0] = trans_q
            df_de_out.iloc[i, 1] = trans_a
        print(f"✅ [DE] Rad {i+1} klar")

    # liten paus för att undvika rate limit
    time.sleep(1.2)

# Skriv ny fil
with pd.ExcelWriter(output_file, engine="openpyxl") as writer:
    df_se.to_excel(writer, sheet_name="FAQ_SE", index=False)
    df_en.to_excel(writer, sheet_name="FAQ_EN", index=False)
    df_da_out.to_excel(writer, sheet_name="FAQ_DA", index=False)
    df_de_out.to_excel(writer, sheet_name="FAQ_DE", index=False)

print(f"🎉 Klar! Sparad till {output_file}")
