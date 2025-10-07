import json
import csv
import os
import re
from collections import Counter

# --- Config ---
INPUT_FILE = os.path.join("faq-extended", "faq_multilang_preview.json")
OUTPUT_FILE = os.path.join("faq-extended", "faq_multilang_patched_v4.json")
LOG_FILE = os.path.join("faq-extended", "faq_multilang_patch_log_v4.csv")

# --- Settings ---
TRUNCATE_LIMIT = 200
TRUNCATE_SUFFIX = {
    "se": " … Vill du se fler?",
    "en": " … Would you like to see more?",
    "da": " … Vil du se flere?",
    "de": " … Möchten Sie mehr sehen?",
}

FORMAT_WHITELIST = {
    "20x120", "40x120", "60x60", "80x80",
    "90x90", "120x120", "30x120", "45x90", "80x180"
}

# --- Helpers ---
def truncate_text(text: str, lang: str, limit: int = TRUNCATE_LIMIT):
    """Truncate text and append language-specific suffix."""
    if not text or len(text) <= limit:
        return text, False
    cutoff = text[:limit].rsplit(" ", 1)[0]
    return cutoff + TRUNCATE_SUFFIX.get(lang, ""), True

def normalize_format(text: str):
    """Normalize size formats (with or without cm)."""
    if not text:
        return text, False
    # fix "60 x 60 cm" -> "60x60 cm"
    new_text = re.sub(r"(\d+)\s*[xX]\s*(\d+)\s*cm?", r"\1x\2 cm", text)
    # fix "60x60cm" -> "60x60 cm"
    new_text = re.sub(r"(\d+x\d+)\s*cm?", r"\1 cm", new_text)
    return new_text, (new_text != text)

def check_format_whitelist(text: str):
    """Check if any size format in text is not whitelisted."""
    if not text:
        return None
    # hitta alla matchade format (t.ex. 60x60)
    matches = re.findall(r"\b(\d+x\d+)\b", text)
    for m in matches:
        if m not in FORMAT_WHITELIST:
            return m
    return None

def load_domain_words():
    path = os.path.join("config", "keywords", "colors_and_series.json")
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
            if isinstance(data, dict):
                words = []
                for v in data.values():
                    words.extend(v)
                return set(w.lower() for w in words)
            return set(w.lower() for w in data)
    return set()

# --- Main ---
def main():
    with open(INPUT_FILE, encoding="utf-8") as f:
        data = json.load(f)

    domain_words = load_domain_words()
    changes = []

    for idx, item in enumerate(data):
        for lang in ["se", "en", "da", "de"]:
            for field in [f"answer_{lang}", f"answer_full_{lang}"]:
                if field not in item:
                    continue

                original = item[field]

                # Missing check
                if lang == "se":
                    text = original
                else:
                    if not original or str(original).strip() == "":
                        text = "MISSING_TRANSLATION"
                        changes.append({
                            "Index": idx, "Lang": lang.upper(), "Field": field,
                            "ChangeType": "MISSING", "Original": str(original), "Patched": text
                        })
                    else:
                        text = original

                # Truncate
                truncated, did_trunc = truncate_text(text, lang)
                if did_trunc:
                    changes.append({
                        "Index": idx, "Lang": lang.upper(), "Field": field,
                        "ChangeType": "TRUNCATED", "Original": text, "Patched": truncated
                    })
                    text = truncated

                # Normalize sizes
                normalized, did_norm = normalize_format(text)
                if did_norm:
                    changes.append({
                        "Index": idx, "Lang": lang.upper(), "Field": field,
                        "ChangeType": "FORMAT_NORMALIZED", "Original": text, "Patched": normalized
                    })
                    text = normalized

                # Check whitelist
                bad_format = check_format_whitelist(text)
                if bad_format:
                    changes.append({
                        "Index": idx, "Lang": lang.upper(), "Field": field,
                        "ChangeType": "INVALID_FORMAT", "Original": text, "Patched": text
                    })

                # Protect domain words
                if any(w in text.lower() for w in domain_words):
                    changes.append({
                        "Index": idx, "Lang": lang.upper(), "Field": field,
                        "ChangeType": "SERIES_PROTECTED", "Original": text, "Patched": text
                    })

                item[field] = text

    # Save patched JSON
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    # Save log
    with open(LOG_FILE, "w", encoding="utf-8", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=["Index", "Lang", "Field", "ChangeType", "Original", "Patched"])
        writer.writeheader()
        writer.writerows(changes)

    # Print summary
    counts = Counter(c["ChangeType"] for c in changes)
    print(f"✅ Klar: {len(data)} FAQ patchade")
    for k, v in counts.items():
        print(f"{k}: {v}")

    # Show examples
    for cat in ["TRUNCATED", "FORMAT_NORMALIZED", "INVALID_FORMAT", "SERIES_PROTECTED", "MISSING"]:
        subset = [c for c in changes if c["ChangeType"] == cat][:5]
        if subset:
            print(f"\n🔎 Exempel {cat}:")
            for s in subset:
                print(f"  {s['Lang']} {s['Field']} → {s['Patched']}")

if __name__ == "__main__":
    main()
