import os
import re
import pandas as pd
import json
from datetime import datetime

BASE_DIR = "faq-extended"

def normalize_keyword(word: str) -> str:
    if not isinstance(word, str):
        return ""
    w = word.strip()

    # Specialfall
    if w.lower() == "uv":
        return "UV-tålig"
    if w.lower() == "ce":
        return "CE-märkning"

    # Plattmått (format som 60x60, 100x100cm osv.)
    size_match = re.match(r"^\s*(\d+)\s*x\s*(\d+)\s*(cm)?\s*$", w, re.IGNORECASE)
    if size_match:
        return f"{size_match.group(1)}x{size_match.group(2)} cm"

    # Piedestalhöjder (rena tal mellan 50–1000) → mm
    height_match = re.match(r"^\d+$", w)
    if height_match:
        num = int(height_match.group(0))
        if 50 <= num <= 1000:
            return f"{num} mm"

    return w

def should_keep(word: str) -> bool:
    if not word:
        return False
    if word in ("UV-tålig", "CE-märkning"):
        return True
    return len(word) >= 3

def normalize_list(words):
    seen = set()
    cleaned = []
    piedestal_conversions = []  # logglista för piedestaler
    for w in words:
        nw = normalize_keyword(w)
        if should_keep(nw):
            key = nw.lower()
            if key not in seen:
                seen.add(key)
                cleaned.append(nw)
                # Om originalet var ett rent tal och nu slutar på "mm" → logga
                if re.match(r"^\d+$", w) and nw.endswith(" mm"):
                    piedestal_conversions.append(f"{w} → {nw}")
    return cleaned, piedestal_conversions

def main():
    old_file = os.path.join(BASE_DIR, "Keywords 533.csv")
    new_file = os.path.join(BASE_DIR, "faq_keywords_se_normalized.csv")

    old_norm_file = os.path.join(BASE_DIR, "keywords_533_normalized.csv")
    final_csv = os.path.join(BASE_DIR, "faq_keywords_se_final.csv")
    final_json = os.path.join(BASE_DIR, "faq_keywords_se_final.json")

    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    log_file = os.path.join(BASE_DIR, f"merge_log_{ts}.txt")

    # Steg 1: normalisera gamla
    df_old = pd.read_csv(old_file)
    old_words = df_old["SE"].dropna().astype(str).tolist()
    old_norm, old_piedestals = normalize_list(old_words)
    pd.DataFrame(old_norm, columns=["SE"]).to_csv(old_norm_file, index=False, encoding="utf-8-sig")

    # Steg 2: ladda nya
    df_new = pd.read_csv(new_file)
    new_words = df_new["SE"].dropna().astype(str).tolist()
    new_norm, new_piedestals = normalize_list(new_words)

    # Steg 3: slå ihop & dedupe
    merged, merged_piedestals = normalize_list(old_norm + new_norm)
    merged_sorted = sorted(merged)

    # Steg 4: export
    pd.DataFrame(merged_sorted, columns=["SE"]).to_csv(final_csv, index=False, encoding="utf-8-sig")
    with open(final_json, "w", encoding="utf-8") as f:
        json.dump({"SE": merged_sorted}, f, ensure_ascii=False, indent=2)

    # Steg 5: logg
    with open(log_file, "w", encoding="utf-8") as f:
        f.write(f"Merge run {ts}\n")
        f.write(f"Gamla keywords (rå): {len(df_old)}\n")
        f.write(f"Gamla keywords (normaliserade): {len(old_norm)}\n")
        f.write(f"Nya keywords (normaliserade): {len(new_norm)}\n")
        f.write(f"Totalt efter merge: {len(merged_sorted)} unika keywords\n\n")

        f.write("Första 20:\n")
        f.write("\n".join(merged_sorted[:20]))
        f.write("\n\nSista 20:\n")
        f.write("\n".join(merged_sorted[-20:]))

        # Ny sektion: piedestal-höjder
        f.write("\n\nPiedestal-konverteringar (tal → mm):\n")
        all_piedestals = sorted(set(old_piedestals + new_piedestals + merged_piedestals))
        f.write("\n".join(all_piedestals))

    print(f"🎉 Slutlig lista klar: {len(merged_sorted)} unika keywords")
    print(f"📂 CSV:  {final_csv}")
    print(f"📂 JSON: {final_json}")
    print(f"📝 Logg: {log_file}")
    print("👉 Kolla loggfilen för lista över piedestal-konverteringar.")

if __name__ == "__main__":
    main()
