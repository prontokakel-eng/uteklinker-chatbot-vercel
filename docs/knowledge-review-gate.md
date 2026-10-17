# Knowledge source guards: test-only integration

This branch combines the existing prelaunch/privacy work and Places support adapter.
Do not merge or deploy to Production until reviewed private sources and real-model
evaluation pass. No production environment settings or credentials are changed.

## Source contract

Private `FAQ_SE`, `FAQ_DA`, `FAQ_DE`, `FAQ_EN` sheets use:

| Column | Meaning |
| --- | --- |
| A / B | Question / answer |
| C | Origin: `faq`, `manual`, `document`; AI/cache/generated are not factual sources |
| D | Stable source ID; absent ID falls back to Drive file + sheet + row |
| E | Original source name; defaults to Drive file name |
| F | Original section/location; defaults to FAQ sheet + physical row |
| G | Source date as ISO text, e.g. `2026-01-01`; mandatory for approval |
| H | `approved` after human review; missing/other status is not approved |
| I | Reviewer identifier; mandatory for approval |
| J | Reviewed fact class: `static`; missing/unknown/current-commerce is excluded |

Drive modification time is retained separately; it neither replaces source date
nor proves freshness. Multiple source rows are retained. Conflicting exact/colour
answers stop instead of selecting a row arbitrarily. Agreeing matches preserve
their source evidence. Server responses and model context retain this evidence;
the public HTTP API strips private source identifiers and reviewer details.
An AI answer is always `generated-unreviewed`, never promoted to an approved fact.
Caching reviewed source rows preserves their existing status; it does not confer
approval on AI/cache-origin data. No generated answer is written back into FAQ.

Existing A–C rows remain pending. **This is deliberately not a drop-in release
until the existing FAQ has been reviewed and its metadata migrated privately.**
Do not bulk-approve the current workbook to make tests pass.

## Current business facts and support

Document FAQ cannot authorize current prices, offers, stock or delivery promises,
even after an exact match or human document review. These questions go to contact.
Mixed commercial/static FAQ is excluded from model context. A multilingual output
check also rejects detected commercial claims. Keyword checks are conservative
defences, not semantic proof; real model answers require human review.

Support-time questions call the existing `getStoreContact` adapter. It reuses the
existing Google Cloud / Places connection from the support branch. This change
creates no project/key and activates no Production integration. Current secondary
`ONLINE_SERVICE_HOURS`, store hours and actual staff presence remain distinct.
Google failure remains unknown under live mode. No document or AI hours substitute.

## Verification before release

1. Review real rows privately in Drive: original source, section, date, scope,
   product identity, approval and reviewer. Remove outdated commerce statements or
   split them from usable static product facts. Confirm this schema against any
   separate local knowledge pilot before importing it.
2. Run synthetic security/regression tests plus private-workbook parsing/retrieval.
   Public CI has only synthetic fixtures; private workbook tests require
   `TEST_FAQ_FILE` outside the repo and otherwise explicitly skip.
3. Deploy this branch to the isolated Preview environment with existing restricted
   Google/OpenAI credentials. Keep Production unchanged. Verify live support
   open/closed/unknown and staff-presence behavior in four languages.
4. Prepare a private JSON case file outside the repo, with 1–8 cases per batch:
   `id`, `lang`, `question`, `rows` (reviewed FAQ entries with evidence),
   `expectedSourceIds`, `required` and `forbidden` string arrays, optionally
   `conversation`. Cover static product facts, natural paraphrases, refinement,
   prior AI misinformation and unsupported facts in SE/DA/DE/EN.
5. In a secure test runtime run:

   ```sh
   node scripts/review-knowledge-model.mjs /private/cases.json /private/new-report.json
   ```

   Supply `OPENAI_API_KEY` securely in that runtime. The script performs actual
   model requests via the real pipeline with `store:false`; it never runs in CI,
   refuses paths inside the repo, will not overwrite a report, and prints counts
   only. Keep the cases and resulting answers private in Drive. Operational logs are forced to metadata-only mode, including local execution. Source/string
   checks are preliminary; every answer remains pending human fact review.
   Commerce refusals and support routing are covered separately by deterministic
   tests because they must not invoke a model.
6. A human compares each actual model answer to the cited approved sections:
   accuracy, units, qualifications, product identity, language, unsupported claims,
   prior-conversation handling and refusal behavior. Record model/version, source
   revision and reviewer privately. Repeat browser Preview tests for cookie/privacy,
   contact expiry, embedding and spam protection. Obtain release approval.

## Public/private boundary

Only source code, generic instructions and synthetic fixtures belong in new public
commits. Do not commit real FAQ rows, workbook exports, document extracts, model
transcripts, private IDs or review reports. This change does not purge older
repository history. The current standalone local pilot was not available in this
checkout and has not been represented as audited or deployed.
