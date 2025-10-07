import requests
from bs4 import BeautifulSoup
import re
import json

BASE_URL = "https://prontokakel.starwebserver.se/category/uteklinker"

def normalize_format(fmt: str):
    """Normalisera till t.ex. 60x60cm eller 26,5x180cm"""
    fmt = fmt.strip().lower().replace(" ", "").replace("cm","")
    m = re.match(r"^(\d{1,3}(?:,\d{1,2})?)x(\d{1,3}(?:,\d{1,2})?)$", fmt)
    if m:
        w, h = m.groups()
        return f"{w}x{h}cm"
    return None

def scrape_pronto():
    res = requests.get(BASE_URL)
    res.raise_for_status()
    soup = BeautifulSoup(res.text, "html.parser")

    # Leta rätt på script-blocket som innehåller produkt-JSON
    script_tag = None
    for script in soup.find_all("script"):
        if "application/ld+json" in script.get("type",""):
            continue
        if "product" in script.text.lower():
            script_tag = script
            break

    if not script_tag:
        raise RuntimeError("Kunde inte hitta JSON-block i sidan")

    # Försök hitta JSON med regex
    json_match = re.search(r"\{.*\}", script_tag.string, re.DOTALL)
    if not json_match:
        raise RuntimeError("Kunde inte extrahera JSON")

    raw_json = json_match.group(0)

    try:
        data = json.loads(raw_json)
    except json.JSONDecodeError:
        raise RuntimeError("JSON kunde inte avkodas")

    # Bygg datastruktur serie → färg → format
    result = {}
    for prod in data.get("products", []):
        serie = prod.get("series") or prod.get("name","Okänd serie")
        color = prod.get("color") or "Okänd färg"
        formats = []

        for f in prod.get("formats", []):
            nf = normalize_format(f)
            if nf:
                formats.append(nf)

        if not formats:
            continue

        if serie not in result:
            result[serie] = {}
        result[serie][color] = sorted(set(formats))

    return result

if __name__ == "__main__":
    result = scrape_pronto()
    with open("valid_formats_by_series.json", "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    print(f"✅ {len(result)} serier sparade i valid_formats_by_series.json")
