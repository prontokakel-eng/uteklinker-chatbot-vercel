# /config/lexicon — README

This folder holds **language lexicons** that drive the language detector (v6.3+).  
Instead of hard‑coding articles/negations/regex/normalization in code, we load them from JSON here.

## Files
- `SE.json`, `EN.json`, `DA.json`, `DE.json` — per‑language lexicons
- (Optional) Add more, e.g. `NO.json`, `FI.json`

## JSON schema (per language)
```jsonc
{
  "lang": "SE",
  "articles": ["en", "ett", "den", "det"],          // optional, used in heuristics/rules
  "negations": ["inte", "ej"],                       // optional
  "common": ["och", "att", "som", "har"],            // optional
  "regex": {
    "prefix": ["^(om|av|för|till)"],                 // optional; applied with /i
    "suffix": ["(ning|het|skap|ande|else)\b"]       // optional; applied with /i
  },
  "regexAnchors": {
    "exclusive": ["[åäö]"],                          // strong language anchors (unique chars/sequences)
    "soft": ["\b(the|and|which)\b"]                // weaker anchors (optional)
  },
  "boosters": ["vilka","vilken","finns"],            // optional keyword boosters
  "fallbackTriggers": ["vilka","vilken","varför"],   // optional; early fallback hints
  "fallbackExcludes": ["welche","nicht"],            // optional; suppress fallback
  "normalize": {
    "methods": ["NFD","NFC"],                        // optional; Unicode normalization steps
    "remove": ["[\u0300-\u036f]"]                  // optional; regexes to strip combining marks
  },
  "accentMap": { "ß": "ss", "ö": "o" },              // optional; literal char replacements
  "geoMapping": { "SE": "SE", "GB": "EN" },          // optional; country → language
  "weights": {
    "articles": 0.6,
    "negations": 0.4,
    "common": 0.3,
    "regex": 0.5,
    "anchors": 0.6,
    "anchorsSoft": 0.25
  }
}
```

> **Notes**
> - All arrays are optional. Missing sections are simply ignored.
> - Regex strings are compiled with the `i` flag.
> - `weights` tune how much each signal contributes. Reasonable defaults exist in code if omitted.

## How detection uses these files

- `detect-lang-heuristics.js`: token/regex contributions from `articles`, `negations`, `common`, `regex.prefix/suffix`.
- `detect-lang-rules.js`: strong/soft anchors via `regexAnchors`, plus the same lists as above; can return `via="regex-exclusive"`.
- `detect-lang-core.js`: fallback triggers/excludes, normalization and geo mapping are read from lexicon and applied early (v6.3).

## Add a new language

1. **Create the file**: e.g. `NO.json` in this folder.
2. Fill it with at least **one** of the following: `regexAnchors.exclusive`, or some mix of `common/articles/negations/regex`.
3. (Optional) `normalize` + `accentMap` if language has diacritics.
4. (Optional) `geoMapping` entries.
5. **Test**:
   ```bash
   NODE_ENV=test node tests/detect-lang-lexicon.test.mjs
   node tests/Super-torture-suite.repo.mjs --limit=20 --parallel=8 --ai-fallback=off
   ```

## Versioning & safety

- Keep changes **data‑only**. Do not expose secrets here.
- Use PRs and include a short note on what you changed and **why** (e.g. noise reduction, higher DA precision).
- If a change increases false positives, reduce weight in `weights` or move a pattern from `exclusive` to `soft`.

## Quick checklist

- [ ] Does the new lexicon improve detection on your sample set?
- [ ] Are anchors truly language‑specific? (`exclusive` too broad → false positives)
- [ ] Do normalization rules avoid collapsing important diacritics?
- [ ] Did you run the **sanity** and **torture** tests?

---

### Examples

See the project’s initial lexicons (`SE.json`, `EN.json`, `DA.json`, `DE.json`) for concrete values derived from `heuristics/rules` code.
