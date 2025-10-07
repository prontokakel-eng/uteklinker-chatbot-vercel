import pandas as pd

# Ladda filen
file = "Faq med 553 frågor och svar SE DA EN DE.xlsx"
df_dict = pd.read_excel(file, sheet_name=None)

issues = []

for sheet, df in df_dict.items():
    print(f"🔎 Kollar flik: {sheet}")

    # Säkra att vi bara tittar på question/answer kolumner
    q_col = [c for c in df.columns if "question" in c.lower()][0]
    a_col = [c for c in df.columns if "answer" in c.lower()][0]

    # Tomma celler
    empty_q = df[df[q_col].isna()]
    empty_a = df[df[a_col].isna()]
    if not empty_q.empty:
        issues.append(f"❌ {sheet}: {len(empty_q)} frågor saknas")
    if not empty_a.empty:
        issues.append(f"❌ {sheet}: {len(empty_a)} svar saknas")

    # Små bokstäver i början
    bad_caps_q = df[~df[q_col].astype(str).str[0].str.isupper()]
    bad_caps_a = df[~df[a_col].astype(str).str[0].str.isupper()]
    if not bad_caps_q.empty:
        issues.append(f"⚠️ {sheet}: {len(bad_caps_q)} frågor börjar inte med stor bokstav")
    if not bad_caps_a.empty:
        issues.append(f"⚠️ {sheet}: {len(bad_caps_a)} svar börjar inte med stor bokstav")

    # Dubbletter av frågor
    dups = df[df[q_col].duplicated(keep=False)].sort_values(q_col)
    if not dups.empty:
        issues.append(f"🔁 {sheet}: {dups[q_col].nunique()} unika frågor har dubbletter")

# Summering
print("\n===== 📊 Rapport =====")
if issues:
    for i in issues:
        print(i)
else:
    print("✅ Inga problem hittade!")
