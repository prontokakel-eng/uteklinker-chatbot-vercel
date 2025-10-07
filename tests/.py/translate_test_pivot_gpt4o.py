import pandas as pd
from openai import OpenAI

client = OpenAI()  # API-nyckel via $env:OPENAI_API_KEY

# Ladda Excel
df_dict = pd.read_excel("faq_ 500 frågor.xlsx", sheet_name=None)

# Gör kopior för att inte förstöra original-FAQ_SE
faq_se_orig = df_dict["FAQ_SE"].copy()
faq_en = df_dict["FAQ_EN"].copy()
faq_da = df_dict["FAQ_DA"].copy()
faq_de = df_dict["FAQ_DE"].copy()

# Begränsa till rad 100–104 (index 99:104)
sub_df = faq_se_orig.iloc[99:104]

# --- Steg 1: SE → EN ---
translation_map_en = {}

for idx, row in sub_df.iterrows():
    q_se, a_se = row["question_se"], row["answer_se"]

    # Fråga till engelska
    resp_q = client.chat.completions.create(
        model="gpt-4o",   # 🔥 Bytt till gpt-4o
        messages=[{"role": "user", "content": f"Translate this Swedish question into English:\n\n{q_se}"}],
    )
    q_en = resp_q.choices[0].message.content.strip()

    # Svar till engelska (unik)
    if a_se not in translation_map_en:
        resp_a = client.chat.completions.create(
            model="gpt-4o",   # 🔥 Bytt till gpt-4o
            messages=[{"role": "user", "content": f"Translate this Swedish answer into English:\n\n{a_se}"}],
        )
        translation_map_en[a_se] = resp_a.choices[0].message.content.strip()

    a_en = translation_map_en[a_se]

    faq_en.loc[idx, "question_en"] = q_en
    faq_en.loc[idx, "answer_en"] = a_en
    faq_en.loc[idx, "AutoTranslated"] = True

# --- Steg 2: EN → DA + DE ---
translation_map_da, translation_map_de = {}, {}

for idx, row in faq_en.loc[99:104].iterrows():
    q_en, a_en = row["question_en"], row["answer_en"]

    # Fråga → danska
    resp_da_q = client.chat.completions.create(
        model="gpt-4o",   # 🔥 Bytt till gpt-4o
        messages=[{"role": "user", "content": f"Translate this English question into Danish:\n\n{q_en}"}],
    )
    q_da = resp_da_q.choices[0].message.content.strip()

    # Fråga → tyska
    resp_de_q = client.chat.completions.create(
        model="gpt-4o",   # 🔥 Bytt till gpt-4o
        messages=[{"role": "user", "content": f"Translate this English question into German:\n\n{q_en}"}],
    )
    q_de = resp_de_q.choices[0].message.content.strip()

    # Svar → danska (unik)
    if a_en not in translation_map_da:
        resp_da_a = client.chat.completions.create(
            model="gpt-4o",   # 🔥 Bytt till gpt-4o
            messages=[{"role": "user", "content": f"Translate this English answer into Danish:\n\n{a_en}"}],
        )
        translation_map_da[a_en] = resp_da_a.choices[0].message.content.strip()

    # Svar → tyska (unik)
    if a_en not in translation_map_de:
        resp_de_a = client.chat.completions.create(
            model="gpt-4o",   # 🔥 Bytt till gpt-4o
            messages=[{"role": "user", "content": f"Translate this English answer into German:\n\n{a_en}"}],
        )
        translation_map_de[a_en] = resp_de_a.choices[0].message.content.strip()

    faq_da.loc[idx, "question_da"] = q_da
    faq_da.loc[idx, "answer_da"] = translation_map_da[a_en]
    faq_da.loc[idx, "AutoTranslated"] = True

    faq_de.loc[idx, "question_de"] = q_de
    faq_de.loc[idx, "answer_de"] = translation_map_de[a_en]
    faq_de.loc[idx, "AutoTranslated"] = True

# --- Spara testfil ---
with pd.ExcelWriter("faq_pivot_test_gpt4o.xlsx", engine="openpyxl") as writer:
    faq_se_orig.to_excel(writer, "FAQ_SE", index=False)  # Orörd
    faq_en.to_excel(writer, "FAQ_EN", index=False)
    faq_da.to_excel(writer, "FAQ_DA", index=False)
    faq_de.to_excel(writer, "FAQ_DE", index=False)

print("✅ Klar! Kolla faq_pivot_test_gpt4o.xlsx (FAQ_SE orörd, gpt-4o översättning)")
