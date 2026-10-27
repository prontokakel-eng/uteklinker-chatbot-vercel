# Preview answer guards and regression commands

The AI dialogue controller returns before the legacy generation path. Its own
final-answer boundary therefore checks retrieved approved drainage facts and
rejects reversed drainage instructions, regardless of the model's `respond.kind`
or omitted citation IDs. The legacy path uses the same drainage predicate.

Product-attribute assertions cannot become factual evidence merely by being
labelled `general` or `clarify`. The dialogue boundary rejects recognized
unsupported property claims and pronoun/nominal variants, ignores previous
assistant claims as evidence, and checks that cited evidence covers the named
product and recognized property family. A colour FAQ cannot authorize a frost
claim. General material definitions and preference clarification remain available.
These deterministic checks are bounded safeguards, not a complete semantic
entailment verifier for every possible natural-language assertion.

An exact, whitelisted dimension input is evaluated before the gibberish filter,
after the rate, blacklist and repetition checks. Unicode letter boundaries in
WL/BL matching prevent an adjoining size number from hiding a blocked word.

`tests/preview-regression.test.mjs` runs Swedish cases through the real Preview
pipeline, dialogue controller, HTTP handler and review writer. Only external
model/knowledge/website/catalog/Sheets services are synthetic. It asserts direct
FAQ answers and zero model calls, fuzzy variants, changed dimensions, incorrect
drainage, unsupported product facts, retained conversations, blacklist/whitelist,
commercial and structural routing, and RAW pending-only writes to `AI_REVIEW`.
Rejected replies and FAQ answers never produce review rows. Storage failures
preserve safe customer answers. It does not write to the live spreadsheet.

Commands:

- `npm test`: all current `tests/*.test.mjs` regressions.
- `npm run test:preview`: the small Swedish Preview baseline.
- `npm run test:faq`: FAQ/source/approval regressions plus the Preview baseline.
- `npm run test:filters`: abuse and whitelist-format regressions.
- `npm run test:smoke`: required whitelist, fuzzy-format and gate checks. Missing
  commands/files fail; the audit no longer silently skips required smoke checks.
- `npm run test:prod`: the local regression suite with `NODE_ENV=production`.
  This does not exercise or modify the deployed Production site. The Preview
  tests explicitly opt into the Preview controller within their fixtures.
- `npm run test:lang`: the existing 18-case language gate regression.
- `npm run lint`: lint runtime/developer scripts. Node 20 web globals are
  declared; a pasted diagnostic block in an old dev script was removed so lint
  can parse it. Existing unused-variable warnings remain.

CI runs the complete test command so new Preview regression files are included
automatically. Three existing workbook-dependent cases require private files
and remain explicitly skipped when those files are absent. Synthetic test data
cannot approve real FAQ content. Review writes are pending drafts; approval is
still tied to human-reviewed source versions and content hashes.

This change does not alter the rate-window policy or cache-outage policy.

## Natural conversation follow-up

Live multi-turn testing exposed false positives in the initial product guard:
sentence-initial capitals and an earlier product topic could turn general
material/slip explanations into unsupported product claims. The guard now
distinguishes a product-bound assertion from a general explanation and keeps
the named-product, property-family, number/rating and drainage checks. Generic
material definitions, contextual clarifications and ordinary safety advice have
positive regression cases alongside the existing unsafe-answer cases.

Natural R-class requests reach the existing exact-identity website adapter on
the active dialogue path after FAQ matching. Preambles, attribution phrases and
explicit customer product references are normalized; extra product qualifiers
and requested formats remain part of the identity and cannot borrow a nearby
variant. The adapter returns the verified published rating with its source
directly, without a generated answer or AI_REVIEW write. Conceptual follow-ups
may still use AI; previous assistant text does not establish a rating value.

The Swedish structural handoff explicitly explains that project complexity
requires support and an assessment of the conditions on site. Ordinary missing
information should receive a useful clarification rather than this handoff.
