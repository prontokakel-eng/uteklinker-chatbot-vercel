# Chatbot prelaunch check — 17 October 2026

## Verified baseline

Production Vercel deployment 7PAuiVbYt35sfbfeUTQM8huu7EnJ reports commit
8430333d1b1a10505614845ed66d91562ced0e7e (main, merged PR #10).
FAQ source: Drive file 1MES3m4yLeNkYuRLjrfDA1uSpdkYnATKQ, modified
15 October 2026 13:28:33 UTC. Parsed rows: SE 267, DA/DE/EN 265 each.
The current source was downloaded read-only; no product facts were edited.

57 baseline tests and 18 language cases passed. Eight real production UI
exchanges checked initial Lava colour lists and refinement in SE, DA, DE, EN:
all initial responses were FAQ; refinements were AI, retained the selected
language and did not repeat names or invent appearance facts. This is a
bounded smoke test, not a guarantee about arbitrary AI responses.

The proposed branch passed live Preview checks for an English structural question
(CONTACT), unknown Lavo (no invented colour list), known Lava (FAQ) and retained
AI refinement. CI/Audit/Sanity Sweep and Vercel all passed.

The added routing matrix covers colours, formats, representative general
installation, unsupported prices, structural weight questions, unsupported grass
installation and unknown series. It initially passed 22/27; natural weight
phrases bypassed personal-contact routing, and an unknown English series
received similar-product context. New guards pass 27/27 and the full 60-test
suite. Matrix AI was stubbed, so it validates routing and selected source facts,
not generated wording. New regression tests assert that these gaps stay closed.

## Contact and opening hours

Production contact response on Saturday 17 October correctly reported support
closed, no phone/human-chat action, and email available. The shop website
separately showed store open 10–14, support closed, next support Monday 10:00.
These are different schedules and must stay distinct.

The actual NEH storefront script already uses Google's Maps JavaScript/Places
API and currentSecondaryOpeningHours type ONLINE_SERVICE_HOURS. Its browser
key must not be copied into the server or have its website restriction weakened.
PR #11 adds an opt-in server Places path; it is open and unmerged. Its real Google API path was validated in Preview
on 17 October, as detailed below. Production still uses a manual snapshot expiring 29 October 2026.
After Google reauthentication, project ferrous-record-510814-a8 was inspected.
Its existing website API key (Klinkerdack - Oppet idag) is restricted to
https://klinkerdack.se/* and Maps JavaScript API / Places API (New). Both APIs
are enabled. The Places quota UI shows GetPlaceRequest at 600/minute and
125,000/day, not adjustable in this view; these shared quotas are not a small
chatbot-specific spending cap. The previous-day API overview showed 156 requests
and 20% errors; the cause has not been traced. No server key was present before this work.

After explicit user approval, a separate key named Chatbot - Places - Preview
was created in this existing project, restricted to Places API (New). The website
key was not changed. No billing plan or quota was changed. The new key is stored
as a Vercel Secret GOOGLE_PLACES_API_KEY, and GOOGLE_PLACES_ENABLED=true is
configured only for Preview branch work/places-support-2026-10-15. Neither is
configured for Production. No IP restriction is claimed for the server key.

Preview deployment C6VWVbeAXHPXiogWqerNn3Ukvxhh, source 573082a, was rebuilt:
https://uteklinker-chatbot-vercel-jwwh1hkn3.vercel.app
Four real /api/contact checks (SE, DA, DE, EN) passed ten assertions each:
HTTP 200, google-places source, store open, support closed, staff unavailable,
email-only actions, expiry present, seven-day schedule, no Set-Cookie and
Cache-Control no-store. Messages and email labels matched each selected language.
This validates the current Saturday state; open-support and transition/failure
behaviour remain covered by simulated tests, not a real weekday observation.
Production was checked separately and still uses the manual route. Shared
contact-endpoint abuse protection and spending controls remain launch gates.

Actual human-chat provider presence is a separate prerequisite: opening hours
alone cannot establish staff availability. Confirm the provider/presence endpoint
before offering human chat. Email remains available in unknown/closed states.

## Production abuse protection

Vercel Rules UI verified the enabled rule "Chat API 10 per minute per IP":
request path equals /api/chat, fixed 60-second window, 10 requests, IP key,
429 response. Bot protection and system mitigations were active. This runs before application code, in addition to the per-instance limiter.
Vercel documents that counters are per-region, not one global spending cap.
A controlled burst of eleven greeting-only requests completed within 8.4 seconds:
ten returned GREETING and one returned HTTP 429 with the Vercel mitigation header.
No answer-model calls were required. This is a single-origin smoke test, not a
fleet load test or proof of a spending cap. An earlier sequential probe exceeded
one minute and was therefore not a valid test of the per-minute threshold.
The /api/contact endpoint is outside this rule. PR #11 has a separate local
limiter before live Google calls. An additional regression test now proves that
requests beyond ten are rejected before the Places fetch, including when the
caller rotates SE/DA/DE/EN or supplies an invalid language. This uses an isolated
process with fake fetch and fixture credentials. The full PR #11 suite passed
69/69 with the current workbook and no skips.

On 17 October an unsaved Preview-only contact WAF rule was prepared, but selecting
Rate Limit opened a Pro upgrade prompt. The proposal was cancelled; no firewall
settings or subscription were changed. Official limits confirm Hobby allows one
rate-limiting rule per project, already occupied by /api/chat:
https://vercel.com/docs/vercel-firewall/vercel-waf/rate-limiting

After explicit user approval on 17 October, the existing WAF rule was updated
and published: Request Path equals /api/chat OR /api/contact; Fixed Window
60 seconds, Request Limit 10, IP counting key, HTTP 429. The active rule is named
Chat and Contact APIs 10 per minute per IP. Both routes share the ten-request
budget per IP per region; a contact refresh consumes one request.

A bounded production check at 09:01 UTC sent ten concurrent contact requests:
all returned HTTP 200. Two subsequent requests, one contact and one greeting-only
chat request, both returned HTTP 429 with x-vercel-mitigated: deny. All twelve
completed within 12.67 seconds and reported region sfo1. After a cooldown, both
routes returned HTTP 200 again; the chat response was GREETING. The production
contact route still had Places disabled. No new application code was deployed,
no PR was merged, and no subscription or billing plan was changed. Test data
contained no customer questions or personal information. This is one-origin,
one-region verification, not a global spending cap or distributed-attack test.
Separate route counters would require another solution or plan.

## Privacy and cookies

PR #12 now also replaces the old eager iframe launcher with explicit-open loading,
removes legacy cross-window save handlers and destroys the iframe on closing.
The short AI notice is displayed before input in all four languages. Three new
simulated-DOM regressions pass with blocked storage; the branch suite is 63/63
with the current workbook and no skips. A technical browser test page is included.
Full draft text, verified facts and the remaining NEH/Cookiebot test matrix are
in docs/chat-integritet-och-inbaddning-2026-10-17.md. This is not a completed
consent audit or a published full privacy policy.

The deployed UI stored optional sound/list preferences in localStorage and
could fail when embedded browser storage is blocked. The proposed branch uses
page memory instead. It also replaces production application log messages with
module/timestamp events, and removes the legacy API-key-prefix log. This does
not remove Vercel's infrastructure logs or OpenAI abuse-monitoring retention.

The app sends the current question, at most six bounded dialogue turns, and
server-selected FAQ to OpenAI for AI responses. Responses use store:false.
FAQ-only responses do not call the answer model. Language detection can
separately call OpenAI for otherwise unclear text. store:false is not a promise
of zero retention; verify account-specific provider controls and processing terms.

Read-only unauthenticated HTTP checks found no Set-Cookie on the chat homepage
or contact endpoint. This does not prove absence of cookies under bot challenges,
iframes, different browsers or the final embedding. The storefront uses Cookiebot;
its current browser session allowed every category, so this was not a fresh
reject-all test. The current homepage HTML had no reference to this chatbot.
Final before-consent/reject/accept/withdraw and third-party-storage-disabled tests
must run on a staged version of the actual embed before launch. Load the chat
only on explicit user opening; verify that no unrelated analytics/marketing tags
fire with rejected consent. Do not classify all third-party cookies as necessary.

The accessible purchase-terms page only gave a generic GDPR statement and IMY
link. It did not explain this chatbot's AI provider, purposes, retained data or
retention. A launch-specific privacy section is still needed. Draft short notice:

> Du chattar med en AI-assistent. Svaren kan innehålla fel. För projektspecifik
> dimensionering och säkra besked om pris eller lager hjälper vår personal dig.
> Skriv inte personnummer, betalningsuppgifter eller andra känsliga uppgifter.
> Frågor som behöver AI bearbetas av OpenAI. Läs hur vi hanterar uppgifter i chatten.

Link the last sentence to an actually published privacy section before use.
Prepare the full policy with verified purposes, legal basis, processors, actual
retention, transfers and contact/rights information. Do not invent retention or
claim that no data are stored. Business approval and provider-contract checks
remain outstanding; this review is not legal certification.

Sources checked on 17 October 2026:
- https://pts.se/internet-och-telefoni/kakor-cookies/
- https://www.imy.se/privatperson/dataskydd/vi-guidar-dig/for-dig-som-kund/
- https://developers.openai.com/api/docs/guides/your-data
- https://klinkerdack.se/kopvillkor

## Launch order

1. Review this branch and test its Preview with current FAQ; do not merge yet.
2. The separate server credential and four-language Preview API checks are complete. Verify spending controls and fleet-wide contact-endpoint protection before production activation.
3. Resolve privacy text, processor/retention facts and actual staff presence.
4. Test the final embed's consent and storage behaviour, then graphical QA.
5. User approves production deployment and customer activation.
