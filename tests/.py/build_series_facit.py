import json
import os

INPUT_FILE = "faq-extended/valid_formats_by_series.cleaned.json"
OUTPUT_FILE = "faq-extended/valid_formats_by_series.series.json"

def build_series_facit():
    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    series_map = {}

    for key, formats in data.items():
        # Nyckeln ser ut som "Serie Färg"
        serie = key.split()[0]  # ta första ordet som serie
        if serie not in series_map:
            series_map[serie] = set()
        for fmt in formats:
            series_map[serie].add(fmt)

    # Konvertera sets till sorterade listor
    series_map = {k: sorted(v) for k, v in series_map.items()}

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(series_map, f, ensure_ascii=False, indent=2)

    print(f"✅ Ny facit-fil sparad: {OUTPUT_FILE}")
    print(f"Serier hittade: {len(series_map)}")

if __name__ == "__main__":
    build_series_facit()
