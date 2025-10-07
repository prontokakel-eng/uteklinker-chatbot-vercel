import json
import re

INPUT_FILE = "pronto-farger.json"
OUTPUT_FILE = "valid_formats_by_series.json"

def normalize_format(fmt: str):
    """Normalisera till t.ex. 60x60cm eller 26,5x180cm"""
    if not fmt:
        return None
    fmt = str(fmt).strip().lower().replace(" ", "").replace("cm", "")
    m = re.match(r"^(\d{1,3}(?:,\d{1,2})?)x(\d{1,3}(?:,\d{1,2})?)$", fmt)
    if not m:
        return None
    w, h = m.groups()

    # Försök omvandla till tal
    try:
        w_num = float(w.replace(",", "."))
        h_num = float(h.replace(",", "."))
    except ValueError:
        return None

    # Tillåt bara mått mellan 1 och 240
    if not (1 <= w_num <= 240 and 1 <= h_num <= 240):
        return None

    return f"{w}x{h}cm"

def main():
    with open(INPUT_FILE, "r", encoding="utf-8") as f:
        pronto_data = json.load(f)

    cleaned = {}
    for serie, serie_data in pronto_data.items():
        serie_formats = {}
        for color in serie_data.get("färger", []):
            color_name = color.get("namn", "Okänd färg")
            formats = set()
            for fmt in color.get("format", []):
                nf = normalize_format(fmt)
                if nf:
                    formats.add(nf)
            if formats:
                serie_formats[color_name] = sorted(formats)
        if serie_formats:
            cleaned[serie] = serie_formats

    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(cleaned, f, ensure_ascii=False, indent=2)

    print(f"✅ Sparade {len(cleaned)} serier i {OUTPUT_FILE}")

if __name__ == "__main__":
    main()
