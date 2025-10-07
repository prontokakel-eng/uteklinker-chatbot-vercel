import json
import csv
import os

# --- Config ---
INPUT_FILE = os.path.join("faq-extended", "faq_multilang_preview.json")
OUTPUT_FILE = os.path.join("faq-extended", "faq_multilang_patched_v3.json")
LOG_FILE = os.path.join("faq-extended", "faq_multilang_patch_log_v3.csv")

# --- Helpers ---
def truncate_text(text, limit=200):
    """Truncate text with cutoff marker."""
    if not text or len(text) <= limit:
        return text, False
    cutoff = text[:limit].rsplit(" ", 1)[0]
    return cutoff + " … Vill du se fler?", True

def normalize_format(text):
    """Normalize size formats like 60 x 60 cm → 60x60 cm"""
    import re
    if not text:
        return text, False
    new_text = re.sub(r"(\d+)\s*[xX]\s*(\d+)\s*cm?", r"\1x\2 cm", text)
    return new_text, (new_text != text)

def load_domain_words():
    path = os.path.join("config", "keywords", "colors_and_series.json")
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
            # supports both list or dict
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

                # Skip SE missing check
                if lang == "se":
                    text = original
                    change_type = None
                else:
                    if not original or str(original).strip() == "":
                        text = "MISSING_TRANSLATION"
                        change_type = "MISSING"
                    else:
                        text = original
                        change_type = None

                # Truncate
                truncated, did_trunc = truncate_text(text)
                if did_trunc:
                    changes.append({"Index": idx, "Lang": lang.upper(),
                                    "Field": field, "ChangeType": "TRUNCATED",
                                    "Original": text, "Patched": truncated})
                    text = truncated

                # Normalize sizes
                normalized, did_norm = normalize_format(text)
                if did_norm:
                    changes.append({"Index": idx, "Lang": lang.upper(),
                                    "Field": field, "ChangeType": "FORMAT_NORMALIZED",
                                    "Original": text, "Patched": normalized})
                    text = normalized

                # Protect domain words
                if any(w in text.lower() for w in domain_words):
                    changes.append({"Index": idx, "Lang": lang.upper(),
                                    "Field": field, "ChangeType": "SERIES_PROTECTED",
                                    "Original": text, "Patched": text})

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
    from collections import Counter
    counts = Counter(c["ChangeType"] for c in changes)
    print(f"✅ Klar: {len(data)} FAQ patchade")
    for k, v in counts.items():
        print(f"{k}: {v}")

    # Print first 5 examples per category
    for cat in ["TRUNCATED", "FORMAT_NORMALIZED", "SERIES_PROTECTED", "MISSING"]:
        subset = [c for c in changes if c["ChangeType"] == cat][:5]
        if subset:
            print(f"\n🔎 Exempel {cat}:")
            for s in subset:
                print(f"  {s['Lang']} {s['Field']} → {s['Patched']}")

if __name__ == "__main__":
    main()
