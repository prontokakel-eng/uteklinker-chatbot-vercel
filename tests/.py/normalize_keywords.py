import re
import pandas as pd
import sys
import os

# Standardmapp för FAQ & keywords
BASE_DIR = os.path.join("faq-extended")

def normalize_keyword(word: str) -> str:
    """Normalisera enskilt keyword enligt våra regler."""
    if not isinstance(word, str):
        return ""
    w = word.strip()

    # Specialfall
    if w.lower() == "uv":
        return "UV-tålig"
    if w.lower() == "ce":
        return "CE-märkning"

    # Fångar format som 60x60, 60x60cm, 60 x 60 cm, 100X100 osv.
    size_match = re.match(r"^\s*(\d+)\s*x\s*(\d+)\s*(cm)?\s*$", w, re.IGNORECASE)
    if size_match:
        return f"{size_match.group(1)}x{size_match.group(2)} cm"

    return w

def should_keep(word: str) -> bool:
    """Filtrera bort för korta ord (<3 tecken) utom specialfall."""
    if not word:
        return False
    if word in ("UV-tålig", "CE-märkning"):
        return True
    return len(word) >= 3

def normalize_list(words):
    """Normalisera lista, ta bort dubletter och för korta ord."""
    seen = set()
    cleaned = []
    for w in words:
        nw = normalize_keyword(w)
        if should_keep(nw):
            key = nw.lower()
            if key not in seen:
                seen.add(key)
                cleaned.append(nw)
    return cleaned

if __name__ == "__main__":
    # Standard input/output
    default_input = os.path.join(BASE_DIR, "faq_keywords_se_corrected.csv")
    default_output = os.path.join(BASE_DIR, "faq_keywords_se_normalized.csv")

    input_file = sys.argv[1] if len(sys.argv) > 1 else default_input
    output_file = sys.argv[2] if len(sys.argv) > 2 else default_output

    if not os.path.exists(input_file):
        print(f"❌ Kunde inte hitta inputfil: {input_file}")
        sys.exit(1)

    df = pd.read_csv(input_file)
    if "SE" not in df.columns:
        print("❌ CSV måste ha en kolumn 'SE'")
        sys.exit(1)

    words = df["SE"].dropna().astype(str).tolist()
    normalized = normalize_list(words)

    pd.DataFrame(normalized, columns=["SE"]).to_csv(output_file, index=False, encoding="utf-8-sig")
    print(f"✅ Klar! {len(normalized)} unika keywords sparade till {output_file}")
