import pandas as pd
from openai import OpenAI

client = OpenAI()  # API-nyckeln tas från miljövariabeln

# Ladda Excel
df_dict = pd.read_excel("faq_ 500 frågor.xlsx", sheet_name=None)

faq_se = df_dict["FAQ_SE"]
faq_da = df_dict["FAQ_DA"]

# Bara rad 100–104 för test
sub_df = faq_se.iloc[99:104]

# Ordbok för svar (för att återanvända översättningar)
translation_map = {}

for idx, row in sub_df.iterrows():
    q_se, a_se = row["question_se"], row["answer_se"]

    # Översätt fråga
    resp_q = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": "user", "content": f"Översätt till danska:\n\n{q_se}"}]
    )
    q_da = resp_q.choices[0].message.content.strip()

    # Översätt svar (om inte redan gjort)
    if a_se not in translation_map:
        resp_a = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": f"Översätt till danska:\n\n{a_se}"}]
        )
        translation_map[a_se] = resp_a.choices[0].message.content.strip()

    a_da = translation_map[a_se]

    # Skriv till FAQ_DA
    faq_da.loc[idx, "question_da"] = q_da
    faq_da.loc[idx, "answer_da"] = a_da
    faq_da.loc[idx, "AutoTranslated"] = True

# Spara testfil
with pd.ExcelWriter("faq_da_test.xlsx", engine="openpyxl") as writer:
    df_dict["FAQ_SE"].to_excel(writer, sheet_name="FAQ_SE", index=False)
    faq_da.to_excel(writer, sheet_name="FAQ_DA", index=False)
    df_dict["FAQ_DE"].to_excel(writer, sheet_name="FAQ_DE", index=False)
    df_dict["FAQ_EN"].to_excel(writer, sheet_name="FAQ_EN", index=False)

print("✅ Klar! Kolla faq_da_test.xlsx")
