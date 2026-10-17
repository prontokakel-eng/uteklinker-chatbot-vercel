# Changes

## 2026-10-17 — Prelaunch regression and privacy review

- Load the embedded chat only after opening; remove its document on closing.
  Drop old cross-window save handlers. Keep the launcher independent of browser
  storage and allow NEH to serve it locally with an explicit HTTPS chat URL.
- Display a short AI/data notice in SE/DA/DE/EN. Add an internal privacy draft
  and a technical embed test page; final NEH/Cookiebot checks remain outstanding.
- With embed regressions included, 63 tests pass using the current FAQ workbook.
- Recognize natural weight/load questions in SE/DA/DE/EN before knowledge or AI.
- Extend bounded colour-series matching to English, keeping unknown and modified
  series out of similar-product FAQ context.
- Production application logs keep timestamp/module only. Raw question text,
  IP addresses and key fragments are omitted. Remove the legacy key-prefix log.
  Vercel's own access logs and provider retention are separate and not disabled.
- Keep optional sound/list preferences in page memory. Active chat no longer
  accesses localStorage, including when embedded with browser storage blocked.
  Preferences reset on refresh, as the conversation already does.
- Add CI regressions. 60 tests pass using the current Drive workbook; 18 language
  cases pass. Additional actual-workbook routing matrix: 27/27 after the fix,
  22/27 before it. AI was stubbed for this matrix; eight real production exchanges
  separately verified initial colour FAQ and refinement in every language.

No production deployment, billing, API credentials, support schedule or public
privacy policy is changed. See docs/prelaunch-check-2026-10-17.md for remaining
launch gates. The independently open Places PR #11 is not included here.

## 2026-10-15 — Text-only appearance follow-ups

Live testing exposed an unsupported offer to upload photos after an appearance
follow-up. The customer chat accepts text only. Both the general instructions and
the colour-follow-up instructions now prohibit image-upload requests or image
analysis offers, and direct missing product facts to contact or pasted product
description text. Product appearance still requires explicit FAQ evidence.

## 2026-10-15 — Verified Danish price questions

Recognize `prisen`, `priserne` and `koster` as price requests, including contextual
follow-ups. Without an exact same-language FAQ question, route these requests to
contact before AI or a fuzzy direct answer. Existing verified exact FAQ answers
remain available. The store-fact guard now also runs before the direct FAQ shortcut.
No changes to the blacklist, input limits, rate limits or installation checks.

Regression coverage includes unknown Danish price forms, dialogue follow-ups,
different formats/series and preservation of exact verified price answers.
Local verification: 36 customer-flow, abuse, conversation and colour-match tests
passed with the current four-language workbook; 18 language cases passed.

## 2026-10-15 — Danish/German colour FAQ matching

Natural short colour-list questions can now select a same-language FAQ with the
same exact series name, despite different question wording. This adds a bounded
intent/entity match between the existing exact-text lookup and Fuse search.
Case, whitespace, question/exclamation marks, common dash variants and explicit
series wrappers are normalized only for this additional match. No names, answers
or product descriptions are generated or translated.

Reproductions against the question wording in
`tests/fixtures/faq-lang-benchmark-2025-10-07.json`:

| Language | Existing FAQ | Previously missed question |
| --- | --- | --- |
| DA | Hvilke farver er tilgængelige i Lava-serien? | Hvilke farver har Lava? |
| DA | Same | Hvilke farver findes i Lava? |
| DA | Same | Lava farver? |
| DE | Welche Farben sind in der Lava-Serie erhältlich? | Welche Farben hat Lava? |
| DE | Same | In welchen Farben gibt es Lava? |
| DE | Same | Lava Farben? |

Each example previously returned no hit, even in isolation. All now return the
existing FAQ row with score 0.1, below the pipeline's 0.18 direct-answer limit.
Score 0 remains reserved for the existing exact-text path. Widening Fuse's 0.28
threshold was rejected because textual similarity alone does not establish the
right product or question intent. Normalizing punctuation alone cannot reconcile
these changes in wording and word order.

Recognized colour-list requests for an unknown/modified series return no hits
instead of falling back to a similarly spelled series. Conflicting answers for
the same canonical series also return no hits. Exact FAQ wording still has first
priority, including where canonical source rows conflict. Other intents and SE/EN
continue through the original matching logic. Gate, rate limiting, language
selection, conversation, installation/store-fact guards and AI instructions are
unchanged.

### Validation

- `node --test tests/faq-colour-match.test.mjs`: 13 passed. Against original main:
  7 passed, 6 failed, demonstrating the regressions before the fix.
- `TEST_FAQ_FILE=översättning/faq_golden_translated_20250918_102152.xlsx node --test tests/customer-flow.test.mjs tests/anti-abuse.test.mjs tests/conversation.test.mjs tests/faq-colour-match.test.mjs`:
  34 passed, none skipped. Uses the repository workbook, not current Drive data.
- `npm run test:lang`: 18 passed.
- `npm run audit`: passed (minimal sanity; live Google credentials unavailable).
- `npx eslint lib/drive-knowledge.js`: passed. Added an explicit Node Buffer import
  to resolve the pre-existing undefined-global lint error in this file.
- CI now includes the new regression suite.

The new suite checks each exact DA/DE benchmark question, colour-series
paraphrases across the catalogue, near-spelled/unknown/multiple/modified series,
source-answer conflicts, same-language isolation, actual pipeline gate,
refinement/accepted follow-ups, and representative unsupported price and
installation questions. Fixture answers are synthetic identifiers, not product
facts. No external AI or production calls were used.

### Limits and deployment

Revalidation on 2026-10-15: all 34 tests also passed using the updated
2026-10-13 FAQ workbook snapshot, with no skipped tests. An additional 183
colour paraphrases across 31 Danish and 30 German source rows selected the
original answer correctly. Language regression (18 cases), targeted lint and
local audit passed again. This snapshot check is separate from a live Drive
check in Preview; see the pull request for deployment verification.

This is a finite set of colour-list formulations, not general semantic search.
Appearance, negation, arbitrary paraphrases and other intents are not generalized.
Production Drive contents have not been inspected or live-tested. The checked-in
workbook is older than the workbook cited in PR #3; it validates parsing and the
existing tests, not the current product facts. A Preview check with the actual
FAQ source is still needed before approving production deployment.

During testing, the existing store-fact regex also failed to classify Danish
`Hvad er prisen på Lava?` as CONTACT (it went to AI). It recognizes `priser` but
not `prisen`. This pre-existing, non-colour guard gap is unchanged; AI instructions
still require verified product facts. It should be considered separately.

No production deployment or merge is part of this change.
