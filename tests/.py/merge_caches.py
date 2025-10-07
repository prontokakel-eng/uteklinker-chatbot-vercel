import os
import json

# Paths till cachefiler
old_cache_path = os.path.join("faq-extended", ".cache_faq_translate.json")
new_cache_path = ".cache_faq_translate.json"
merged_cache_path = os.path.join("faq-extended", ".cache_faq_translate_merged.json")

# Läs gamla
if os.path.exists(old_cache_path):
    with open(old_cache_path, "r", encoding="utf-8") as f:
        old_cache = json.load(f)
else:
    old_cache = {}
    print(f"⚠️ Hittade inte {old_cache_path}")

# Läs nya
if os.path.exists(new_cache_path):
    with open(new_cache_path, "r", encoding="utf-8") as f:
        new_cache = json.load(f)
else:
    new_cache = {}
    print(f"⚠️ Hittade inte {new_cache_path}")

# Slå ihop (ny cache har företräde vid krockar)
merged = {**old_cache, **new_cache}

# Spara ny fil
with open(merged_cache_path, "w", encoding="utf-8") as f:
    json.dump(merged, f, ensure_ascii=False, indent=2)

print(f"✅ Slagit ihop {len(old_cache)} (old) + {len(new_cache)} (new) → {len(merged)} entries")
print(f"📄 Sparad till: {merged_cache_path}")
