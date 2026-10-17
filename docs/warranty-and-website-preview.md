# Warranty routing and website pilot

Test integration only. Do not merge, enable Production or publish policy pages.

## Warranty decision

`policy:warranty-contact:v1` routes warranty duration, scope, compensation,
complaints and contextual years/labour/whole-deck follow-ups to the existing
contact options. It makes no promise of reimbursement, remedy or staff contact.
Routing runs after the existing abuse gate and before FAQ, website and model calls.
Technical frost questions are separate. German `gewährleisten` (ensure) must not
be mistaken for the warranty noun `Gewährleistung`.

Retired/rejected/superseded rows and warranty promises are excluded from retrieval
and model context. A model-output check rejects detected warranty/remedy/contact
claims. These bounded checks supplement source review; they are not a semantic
guarantee for all future model text.

The original private Drive FAQ is shared by Production and Preview. Its active
answers must remain unchanged while Production changes are prohibited. Prepare
and verify a private test copy first. The copy has one canonical answer per
language, with related questions linked to it; an excluded decision/audit sheet
records authority, source, review date and superseded answers. It must never be
imported as FAQ or model context. Transfer verified edits back to the original
only in an explicitly approved release step. No real FAQ material or review log
belongs in this public repository.

## Website connection

`WEBSITE_KNOWLEDGE_ENABLED=true` works only with `VERCEL_ENV=preview`.
The loader reads the site's robots file and advertised sitemap, refreshes the
public URL index after 15 minutes, then fetches one strongly selected page.
It does not forward customer questions to a search engine or browse the open web.
Anonymous requests carry no account credentials/cookies. Only HTTPS on the exact
two approved site hosts is permitted; private/action/search/query URLs and unsafe
redirects are rejected. Reads have timeout, size, redirect and sitemap bounds.
No source page scripts execute, no cart/form actions occur and no page HTML is
sent wholesale to a model.

The first deterministic product-property path handles R-class questions in four
languages. It requires exact complete product identity and one consistent rating
in all structured published variants. Unknown formats, Pro/lookalike series,
missing/conflicting attributes fail closed. The answer says what the page lists,
with a clickable source. An R rating never establishes warranty, lifetime slip
protection or accident prevention. No ratings are inferred from a nearby product.

General-page context is an initial conservative pilot: title/URL overlap and
bounded relevant paragraphs, with commercial/warranty/instruction text excluded.
It does not guarantee recall across all natural-language questions or languages.
Broader semantic retrieval, PDFs, variant-specific questions and final model fact
review remain future validation work. New public URLs become eligible when the
sitemap refreshes; they are not automatically human-approved source facts.

Evidence distinguishes `site-published` / `website-observed` from human-reviewed
FAQ facts. It retains exact URL, section, fetch time and content hash. Freshness
is checked again before sending context to a model. Generated explanations remain
unreviewed. Warranty and current commerce restrictions override website content,
including old claims still published on a website. Support hours continue through
the existing contact/Places adapter.

Before enabling this pilot on its isolated Preview branch, verify the synthetic
suite and private FAQ replacements. Then exercise actual pages in Preview and
review generated replies against the recorded sources. Keep Production and the
original shared FAQ unchanged; no model tests can be inferred from deterministic
retrieval tests or a successful deployment.
