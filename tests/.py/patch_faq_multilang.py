import json
import csv
import os

# Paths
BASE_DIR = os.path.join(os.path.dirname(__file__), "..", "..", "faq-extended")
INPUT_FILE = os.path.join(BASE_DIR, "faq_multilang_preview.json")
COLORS_FILE = os.path.join(BASE_DIR, "faq_colors_from_pronto_se_v2.json")
OUTPUT_JSON = os.path.join(BASE_DIR, "faq_multilang_patched.json")
OUTPUT_CSV = os.path.join(BASE_DIR, "faq_multilang_patch_log.csv")

# Maxlängd för svar
MAX_LEN = 200

def truncate_text(text, max_len=MAX_LEN):
    if not text:
        return text, False
    if len(text) <= max_len:
        return text, False
    # kapa på närmaste mellanslag
    cut = text.rfind(" ", 0, max_len)
    if cut == -1:
        cut = max_len
    return text[:cut].strip() + " …", True

def normalize_format(text):
    """Standardisera storlekar: 60x60cm, 45x90cm etc."""
    import re
    if not text:
        return text, False
    pattern = r"(\d{2,3})\s*x\s*(\d{2,3})(\s*cm)?"
    new_text, count = re.subn(pattern, lambda m: f"{m.group(1)}x{m.group(2)}cm", text)
    return new_text, count > 0

def load_domain_words():
    with open(COLORS_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
    domain = set()
    if isinstance(data, dict):
        # hämta både keys och values
        for k, v in data.items():
            domain.add(str(k).lower())
            if isinstance(v, list):
                for item in v:
                    domain.add(str(item).lower())
            else:
                domain.add(str(v).lower())
    elif isinstance(data, list):
        for w in data:
            domain.add(str(w).lower())
    return domain


def protect_domain_words(text, domain_words):
    if not text:
        return text, False
    changed = False
    for word in domain_words:
        if word in text.lower():
            # se till att originalordet behålls
            # här kan vi utöka om vi behöver exakt mappning
            changed = True
    return text, changed

def main():
    if not os.path.exists(INPUT_FILE):
        print(f"❌ Hittar inte inputfil: {INPUT_FILE}")
        return

    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        faq_data = json.load(f)

    domain_words = load_domain_words()

    summary = {"TRUNCATED": 0, "FORMAT_NORMALIZED": 0, "SERIES_PROTECTED": 0, "MISSING": 0}

    with open(OUTPUT_CSV, "w", newline="", encoding="utf-8") as csvfile:
        writer = csv.writer(csvfile)
        writer.writerow(["Index", "Lang", "Original", "Patched", "ChangeType"])

        for idx, item in enumerate(faq_data):
            for lang in ["SE", "EN", "DA", "DE"]:
                original = item.get(lang, "")
                patched = original
                change_type = None

                # missing
                if not patched or patched.strip() == "":
                    patched = "MISSING_TRANSLATION"
                    change_type = "MISSING"
                    summary["MISSING"] += 1

                # truncate
                patched, truncated = truncate_text(patched)
                if truncated:
                    change_type = "TRUNCATED"
                    summary["TRUNCATED"] += 1

                # normalize format
                patched, normalized = normalize_format(patched)
                if normalized:
                    change_type = "FORMAT_NORMALIZED"
                    summary["FORMAT_NORMALIZED"] += 1

                # protect domain words
                _, protected = protect_domain_words(patched, domain_words)
                if protected:
                    change_type = "SERIES_PROTECTED"
                    summary["SERIES_PROTECTED"] += 1

                # skriv logg om ändrat
                if change_type:
                    writer.writerow([idx, lang, original, patched, change_type])

                # uppdatera i data
                item[lang] = patched

    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(faq_data, f, indent=2, ensure_ascii=False)

    print(f"✅ Klar: {len(faq_data)} FAQ patchade")
    for k, v in summary.items():
        print(f"{k}: {v}")

if __name__ == "__main__":
    main()
