# Approved temporary contact hours: 14–30 November 2026

Approved by the owner in the task conversation on 26 October 2026.
Europe/Stockholm, both dates inclusive:

- Store closed every day.
- Phone advice Monday–Friday 10:00–12:00; weekends closed.
- Staff chat permitted only within those hours and with confirmed provider presence.
- FAQ/AI and the verified email contact remain available outside staffed hours.
- No guaranteed email response time has been approved.

The same dated exception is used by the existing chat contact endpoint and the
server-side website opening-hours pilot. It overrides stale/wider Google hours
only during this period and expires automatically at 1 December 00:00 CET.
Existing Places/manual behavior resumes then; this does not renew the old manual
snapshot expiring on 29 October. Source labels distinguish this owner-approved
exception from Google data. Contact actions expire within 15 minutes and at noon.

## Release status and remaining operations

This code is prepared in the existing pilot review branch. A commit or successful
test does not mean the live storefront, Google profile or production is updated.
Reuse the existing Places and website integration; do not run both Maps loaders.

Before declaring the task complete:

1. Publish the reviewed exception with the existing chat/website integration,
   respecting its separate release gates; verify actual UI and contact endpoints.
2. Set dated store closures for 14–30 November in Google Business Profile and
   the corresponding weekday online-service/phone exceptions of 10:00–12:00.
   Do not replace the normal weekly schedule permanently.
3. Ensure the published storefront shows the same dates/times, including its
   service bar, contact page, FAQ contact guidance and booking availability.
4. Verify the visible mailto link uses info@klinkerdack.se. Actual mailbox receipt
   and monitoring are separate checks; no test email has been sent by this change.
5. The owner configures the matching Telenor schedule separately.
6. Check both sides of 10:00 and 12:00, weekend, midnight 14 November and
   midnight 1 December. Phone/personal chat must not close the AI conversation.

Validation: `node --test tests/temporary-contact-hours.test.mjs tests/support-hours.test.mjs tests/places-contact.test.mjs tests/website-opening-hours.test.mjs`.
Tests use synthetic data and dates, with no real customer messages or API keys.
