import os
import pandas as pd
from datetime import datetime
from openai import OpenAI

# Initiera OpenAI-klienten
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

# Input/output
INPUT_FILE = "Faq med 553 frågor och svar SE DA EN DE.xlsx"
timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
OUTPUT_FILE = f"översättning/faq_golden_translated_{timestamp}.xlsx"
RESUME_FILE = f"översättning/resume_{timestamp}.txt"

# Språkflikar
LANGS = ["EN", "DA", "DE"]

def safe_translate(text, src_lang, tgt_lang, row_idx, col_name):
    """Skicka text till OpenAI och översätt säkert."""
    if not isinstance(text, str) or text.strip() == "":
        return text  # Hoppa över tomma celler
    try:
        prompt = (
            f"Översätt följande text från {src_lang} till {tgt_lang}, "
            f"kortfattat och korrekt domänspecifikt språk:\n\n{text}"
        )
        resp = client.chat.completions.create(
            model="gpt-4o",
            messages=[{"role": "user", "content": prompt}],
            temperature=0
        )
        return resp.choices[0].message.content.strip()
    except Exception as e:
        with open(RESUME_FILE, "a", encoding="utf-8") as f:
            f.write(f"❌ Rad {row_idx}, kolumn {col_name}: {e}\n")
        return text  # Returnera originalet så vi inte tappar data

def main():
    print(f"📂 Läser {INPUT_FILE} ...")
    xls = pd.ExcelFile(INPUT_FILE)

    # Läs SE först
    df_se = pd.read_excel(xls, sheet_name="FAQ_SE")

    # Rensa bort tomma kolumner/rader
    df_se = df_se.dropna(how="all", axis=1).dropna(how="all", axis=0)

    print(f"📊 Totalt {len(df_se)} frågor i SE")

    results = {"SE": df_se}

    for lang in LANGS:
        sheet = f"FAQ_{lang}"
        print(f"🔄 Bearbetar {sheet} ...")

        if sheet in xls.sheet_names:
            df = pd.read_excel(xls, sheet_name=sheet)
            df = df.dropna(how="all", axis=1).dropna(how="all", axis=0)
        else:
            df = pd.DataFrame(columns=[f"question_{lang.lower()}", f"answer_{lang.lower()}", "answer_source"])

        # Säkerställ kolumner
        expected_cols = [f"question_{lang.lower()}", f"answer_{lang.lower()}", "answer_source"]
        for col in expected_cols:
            if col not in df.columns:
                df[col] = ""

        # Fyll upp antal rader
        if len(df) < len(df_se):
            for _ in range(len(df), len(df_se)):
                df.loc[len(df)] = ["", "", ""]

        # Översätt saknade celler
        for i in range(len(df_se)):
            se_q = df_se.iloc[i]["question_se"]
            se_a = df_se.iloc[i]["answer_se"]

            if not df.at[i, expected_cols[0]]:
                df.at[i, expected_cols[0]] = safe_translate(se_q, "Svenska", lang, i+1, expected_cols[0])
            if not df.at[i, expected_cols[1]]:
                df.at[i, expected_cols[1]] = safe_translate(se_a, "Svenska", lang, i+1, expected_cols[1])
            if not df.at[i, expected_cols[2]]:
                df.at[i, expected_cols[2]] = "AI"

            if (i+1) % 50 == 0:
                print(f"✅ {lang}: {i+1}/{len(df_se)} rader klara")

        results[lang] = df

    # Spara resultat
    os.makedirs("översättning", exist_ok=True)
    with pd.ExcelWriter(OUTPUT_FILE, engine="openpyxl") as writer:
        for lang, df in results.items():
            df.to_excel(writer, sheet_name=f"FAQ_{lang}", index=False)

    print(f"🎉 Klart! Sparade {OUTPUT_FILE}")

if __name__ == "__main__":
    main()
