#!/usr/bin/env python3
# -*- coding: utf--8 -*-
"""
translate_faq_sheets_se_to_en_da_de.py
--------------------------------------
Översätter FAQ från Google Sheets (FAQ_SE) till EN/DA/DE och skriver tillbaka i respektive flikar.
- Läser .env.local (OPENAI_API_KEY, SHEET_ID_MAIN, GCP_*)
- Skyddar domänord (serier & färger) från config/keywords/faq_colors_from_pronto_se_v2.json
- Skapar teaser (≈200 tecken) och behåller fulltext
- Batchar skrivning (200 rader per gång, delay 5s)
- Cache i faq-extended/.cache_faq_translate.json
"""

import os
import sys
import json
import time
import argparse
import re
from pathlib import Path
from typing import Dict, List
import gspread

try:
    from dotenv import load_dotenv
except Exception:
    load_dotenv = None

# --------- Paths ---------
HERE = Path(__file__).parent.resolve()
ROOT = HERE.parents[2] if (HERE.name == ".py") else HERE
CACHE_PATH = ROOT / "faq-extended" / ".cache_faq_translate.json"
COLORS_JSON = ROOT / "config" / "keywords" / "faq_colors_from_pronto_se_v2.json"

# --------- Load domänord ---------
def load_colors_list() -> List[str]:
    if COLORS_JSON.exists():
        try:
            data = json.loads(COLORS_JSON.read_text(encoding="utf-8"))
            if isinstance(data, dict):
                items = []
                for v in data.values():
                    if isinstance(v, list):
                        items.extend([str(x) for x in v])
                return sorted(set(items), key=str.lower)
            elif isinstance(data, list):
                return sorted(set([str(x) for x in data]), key=str.lower)
        except Exception as e:
            print(f"⚠️ Kunde inte läsa {COLORS_JSON}: {e}")
    return ["albero", "alpine", "agate", "konjak", "lava marsili"]

def make_protect_regex(terms: List[str]) -> re.Pattern:
    safe = sorted(set([t.strip() for t in terms if t.strip()]), key=len, reverse=True)
    parts = [re.escape(t) for t in safe]
    if not parts:
        parts = [r"$^"]
    return re.compile(r"(" + "|".join(parts) + r")", flags=re.IGNORECASE)

KEEP_L = "‹KEEP›"
KEEP_R = "‹/KEEP›"

def protect_terms(text: str, rx: re.Pattern) -> str:
    return rx.sub(lambda m: f"{KEEP_L}{m.group(0)}{KEEP_R}", text)

def unprotect_terms(text: str) -> str:
    return text.replace(KEEP_L, "").replace(KEEP_R, "")

def truncate_teaser(text: str, lang: str, max_len: int = 200) -> str:
    trailers = {
        "EN": " … Would you like to see more?",
        "DA": " … Vil du se flere?",
        "DE": " … Möchten Sie mehr sehen?",
        "SE": " … Vill du se fler?",
    }
    trailer = trailers.get(lang, trailers["EN"])
    base = text.strip()
    if len(base) <= max_len:
        return base
    cut = base[:max_len]
    pivot = max(cut.rfind("."), cut.rfind(","), cut.rfind(" "))
    if pivot == -1:
        pivot = max_len
    return cut[:pivot].rstrip(" ,.;") + trailer

# --------- OpenAI ---------
def get_openai_client():
    try:
        from openai import OpenAI
    except Exception as e:
        print("❌ Paketet 'openai' saknas. Installera med: pip install openai", file=sys.stderr)
        raise
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise RuntimeError("Saknar OPENAI_API_KEY i .env.local")
    return OpenAI(api_key=api_key)

SYS_PROMPT_BASE = (
    "Du är expert på byggmaterial, uteklinker, kakel och klinkerdäck. "
    "Använd facktermer som används i branschens kataloger och produktblad. "
    f"All text mellan {KEEP_L} och {KEEP_R} ska lämnas oförändrad. "
    "Behåll liststrukturer. Översätt idiomatiskt men tekniskt korrekt."
)

def translate_chunk(client, text: str, target_lang: str) -> str:
    lang_prompts = {
        "EN": "Translate to English using industry terms (tiling, exterior porcelain).",
        "DA": "Oversæt til dansk med byggelinje-termer (fliser, udendørs klinker).",
        "DE": "Ins Deutsche übersetzen mit Fachbegriffen (Fliesen, Feinsteinzeug).",
    }
    user_msg = f"Target language: {target_lang}\n\n{text}"
    resp = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": SYS_PROMPT_BASE + " " + lang_prompts[target_lang]},
            {"role": "user", "content": user_msg},
        ],
        temperature=0.2,
    )
    return resp.choices[0].message.content.strip()

# --------- Cache ---------
def load_cache() -> Dict[str, Dict[str, str]]:
    if CACHE_PATH.exists():
        try:
            return json.loads(CACHE_PATH.read_text(encoding="utf-8"))
        except Exception:
            return {}
    return {}

def save_cache(cache: Dict[str, Dict[str, str]]):
    CACHE_PATH.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")

def cache_key(text: str) -> str:
    return text.strip().replace("\n", "\\n")[:4000]

# --------- Main ---------
def main():
    if load_dotenv:
        load_dotenv(ROOT / ".env.local")

    SHEET_ID = os.getenv("SHEET_ID_MAIN")
    GCP_PROJECT_ID = os.getenv("GCP_PROJECT_ID")
    GCP_CLIENT_EMAIL = os.getenv("GCP_CLIENT_EMAIL")
    GCP_PRIVATE_KEY = os.getenv("GCP_PRIVATE_KEY")

    creds = {
        "type": "service_account",
        "project_id": GCP_PROJECT_ID,
        "private_key_id": "dummy",
        "private_key": GCP_PRIVATE_KEY.replace("\\n", "\n"),
        "client_email": GCP_CLIENT_EMAIL,
        "client_id": "dummy",
        "token_uri": "https://oauth2.googleapis.com/token",
    }
    gc = gspread.service_account_from_dict(creds)
    sh = gc.open_by_key(SHEET_ID)

    ws_se = sh.worksheet("FAQ_SE")
    ws_en = sh.worksheet("FAQ_EN")
    ws_da = sh.worksheet("FAQ_DA")
    ws_de = sh.worksheet("FAQ_DE")

    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=0, help="Begränsa antal poster för test")
    parser.add_argument("--batch", type=int, default=20, help="Logga var 20:e post")
    args = parser.parse_args()

    data = ws_se.get_all_records()
    total = len(data)
    limit = args.limit or total

    colors = load_colors_list()
    rx_protect = make_protect_regex(colors)

    cache = load_cache()
    client = get_openai_client()

    updates_en, updates_da, updates_de = [], [], []

    for i, row in enumerate(data[:limit], start=1):
        q_se = (row.get("question_se") or "").strip()
        a_full_se = (row.get("answer_full_se") or "").strip()

        q_prot = protect_terms(q_se, rx_protect)
        a_prot = protect_terms(a_full_se, rx_protect)

        translations = {}
        for lang in ("EN", "DA", "DE"):
            key_q = f"{lang}::Q::{cache_key(q_prot)}"
            key_a = f"{lang}::A::{cache_key(a_prot)}"

            if key_q in cache:
                q_t = cache[key_q]
            else:
                q_t = translate_chunk(client, q_prot, lang)
                cache[key_q] = q_t
                save_cache(cache)

            if key_a in cache:
                a_t_full = cache[key_a]
            else:
                a_t_full = translate_chunk(client, a_prot, lang)
                cache[key_a] = a_t_full
                save_cache(cache)

            q_t = unprotect_terms(q_t)
            a_t_full = unprotect_terms(a_t_full)
            a_t_teaser = truncate_teaser(a_t_full, lang, max_len=200)

            translations[lang] = (q_t, a_t_teaser, a_t_full)

        updates_en.append([translations["EN"][0], translations["EN"][1], translations["EN"][2]])
        updates_da.append([translations["DA"][0], translations["DA"][1], translations["DA"][2]])
        updates_de.append([translations["DE"][0], translations["DE"][1], translations["DE"][2]])

        if i % args.batch == 0 or i == limit:
            print(f"✅ {i}/{limit} klara")

        time.sleep(0.1)

    # batch write to Google
    BATCH_SIZE = 200
    SLEEP_TIME = 5

    def write_batches(ws, values, lang):
        total = len(values)
        for start_idx in range(0, total, BATCH_SIZE):
            end_idx = min(start_idx + BATCH_SIZE, total)
            cell_range = f"A{start_idx+2}:C{end_idx+1}"
            ws.update(cell_range, values[start_idx:end_idx])
            print(f"💾 {lang}: Sparade rader {start_idx+1}–{end_idx}")
            time.sleep(SLEEP_TIME)

    write_batches(ws_en, updates_en, "EN")
    write_batches(ws_da, updates_da, "DA")
    write_batches(ws_de, updates_de, "DE")

    print("🎉 Klar! Alla översättningar sparade i Google Sheets")

if __name__ == "__main__":
    main()
