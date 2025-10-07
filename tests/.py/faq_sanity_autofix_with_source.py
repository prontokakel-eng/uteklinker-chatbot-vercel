import pandas as pd

# Inläsning
input_file = "Faq med 553 frågor och svar SE DA EN DE.xlsx"
output_file = "Faq_cleaned_autofix_with_source.xlsx"

df_dict = pd.read_excel(input_file, sheet_name=None)
fixed_dict = {}

for sheet, df in df_dict.items():
    print(f"🔎 Fixar flik: {sheet}")

    # Identifiera kolumner
    q_col = [c for c in df.columns if "question" in c.lower()][0]
    a_col = [c for c in df.columns if "answer" in c.lower()][0]

    # Leta efter metadata-kolumn (answer_source)
    src_cols = [c for c in df.columns if "faq" in c.lower() or "source" in c.lower()]
    if len(src_cols) > 1:
        answer_source_col = src_cols[0]   # "eller faq sv"
        df = df.rename(columns={answer_source_col: "answer_source"})
    elif "answer_source" not in df.columns:
        df["answer_source"] = "unknown"

    # Fyll i "unknown" om tom
    df["answer_source"] = df["answer_source"].fillna("unknown")

    # --- Fix: stor bokstav ---
    df[q_col] = df[q_col].astype(str).apply(lambda x: x[0].upper() + x[1:] if x and not x[0].isupper() else x)
    df[a_col] = df[a_col].astype(str).apply(lambda x: x[0].upper() + x[1:] if x and not x[0].isupper() else x)

    # --- Dubbletter ---
    df["DuplicateFlag"] = df.duplicated(subset=[q_col], keep=False)

    fixed_dict[sheet] = df

# --- Spara resultat ---
with pd.ExcelWriter(output_file, engine="openpyxl") as writer:
    for sheet, df in fixed_dict.items():
        df.to_excel(writer, sheet_name=sheet, index=False)

print(f"🎉 Autofix + metadata klar! Fil sparad som: {output_file}")
