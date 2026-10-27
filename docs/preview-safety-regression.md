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

## Scoped FAQ revision and 36-turn Swedish acceptance suite

The owner requested an editorial qualification of the two existing Swedish pool
FAQ variants. Their revised source rows live in the existing configured Google
spreadsheet's `FAQ_SE_PREVIEW!A2:L3`; the original FAQ tabs/file are unchanged.
Only the opt-in Preview loader reads this tab. Each manual editorial row needs
normal approval evidence, a matching content hash, the exact original identity,
and the hash of the original reviewed version it replaces. Only two explicitly
superseded versions may be replaced; missing/changed/conflicting revisions hold
those old versions back rather than resurrecting the unconditional claim.
Other FAQ versions and all other languages remain untouched. AI_REVIEW is never
loaded by this mechanism. This is an owner-directed editorial revision, not an
automatic promotion of a customer AI answer. Production does not read the tab.

The private `TEST_DIALOG_SE_36` tab contains six Swedish conversations with six
turns each. Preserve the original eighteen turns and add preference corrections,
an unknown product, topic changes, revised measurements and a context summary.
Source routing is checked automatically; human review still evaluates meaning,
helpfulness and whether catalog results actually preserve corrected preferences.

Run `CHATBOT_TEST_URL=<explicit Preview origin> npm run test:customer --
<absolute private suite.json> <absolute private results.json>`. The runner
requires exactly 36 Swedish turns, sends real previous replies, rate-spaces
requests, checkpoints after every response and fails on declared expectations.
It never commits private test questions, replies or source material. Record
actual results beside the cases in the existing private test tab.
