import pandas as pd
import re

# ===== CONFIG =====
LOOKUP_FILE = r"C:\uteklinker-chatbot-vercel\Faq_keywords_lookup_multilang.xlsx"
FAQ_FILE = r"C:\uteklinker-chatbot-vercel\Faq med 553 frågor och svar SE DA EN DE (4).xlsx"
OUTPUT_FILE = r"C:\uteklinker-chatbot-vercel\Faq_keyword_matches.xlsx"

# ===== Load lookup =====
lookup_df = pd.read_excel(LOOKUP_FILE, sheet_name="LOOKUP_ALL")

# Gör dict per språk
lookup = {
    "SE": lookup_df["SE"].dropna().astype(str).str.lower().tolist(),
    "EN": lookup_df["EN"].dropna().astype(str).str.lower().tolist(),
    "DA": lookup_df["DA"].dropna().astype(str).str.lower().tolist(),
    "DE": lookup_df["DE"].dropna().astype(str).str.lower().tolist(),
}

# ===== Load FAQ =====
faq_sheets = {
    "SE": "FAQ_SE",
    "EN": "FAQ_EN",
    "DA": "FAQ_DA",
    "DE": "FAQ_DE"
}

faq_data = []
for lang, sheet in faq_sheets.items():
    df = pd.read_excel(FAQ_FILE, sheet_name=sheet)
    for _, row in df.iterrows():
        question = str(row.get("Fråga") or row.get("Question") or "")
        answer = str(row.get("Svar") or row.get("Answer") or "")
        text = question.lower()

        # matcha keywords för detta språk
        matched = [kw for kw in lookup[lang] if re.search(rf"\b{re.escape(kw)}\b", text)]
        
        faq_data.append({
            "Lang": lang,
            "Question": question,
            "Answer": answer,
            "Keywords_Found": ", ".join(matched),
            "Match_Count": len(matched)
        })

# ===== Save results =====
out_df = pd.DataFrame(faq_data)
out_df.to_excel(OUTPUT_FILE, index=False)

print(f"✅ Klar! Resultat sparat i {OUTPUT_FILE}")
