# Preview latency experiment

Measure before choosing a faster architecture. Performance metadata contains stage
names, durations, cache state and a per-instance first-request marker; never
customer text, evidence IDs, credentials or raw provider errors. Nested durations
overlap and must not be added as if they were independent. Browser wall time
also includes network and work before the handler; the difference does not prove
that every extra millisecond was cold initialization.

`performance.events` and `Server-Timing` are returned only in Preview. Instrumented
stages include input/language gating, FAQ metadata/download/parsing/editorial
reads, website/catalog tools, each generation/review attempt and Google review
header/append operations. Timings do not alter approval or business routing.

A nine-turn baseline at 4c828da observed a 3,493 ms initial FAQ load, near-zero
in-memory lookup, median generation 3,704 ms per call, median separate review
1,622 ms, and median Google review storage 173 ms (first write 488 ms).
The initial browser-observed request was 16,774 ms; 11,240 ms was measured inside
the handler. These are small-sample measurements, not service-level guarantees.

## Waiting state

The existing dots now have visible localized status immediately, with an honest
long-wait message after seven seconds. Timers stop on completion/failure.
Reduced-motion CSS remains supported. Sound is off by default and stays optional.
No fake percentage or simulated token streaming is shown.

## Private FAQ snapshot

Opt-in Preview may read a private Google Cloud Storage JSON snapshot, stored in
the existing Google project with public access prevention and uniform IAM. The
bucket name is derived from service configuration; no private data/IDs are stored
in this repository. Scope binds source configuration, build, approval digest pins
and superseded FAQ versions. HMAC signing uses the existing server-only key.

A valid snapshot preserves complete normalized rows and provenance. It is only a
cache, never an approval source: current policy/hash checks still apply. It expires
within five minutes of source loading and memory reads cannot extend that expiry.
Invalid, missing, expired or unavailable snapshots fall back to the authoritative
Drive/Sheets loader. Expired data is never a fallback if that loader fails. As with
the previous five-minute memory cache, source edits/revocations can take up to
that cache window to propagate. Set FAQ_FAST_CACHE_ENABLED=false to disable it.

Snapshot writes use Vercel waitUntil as best-effort post-response cache work;
this is deliberately not a durable customer-data queue. No customer questions or
answers enter the snapshot. Heavy workbook/Google API libraries load only when
needed; pending review writes use the same Sheets REST operations through the
existing service account, RAW values and unchanged schema.

## Fewer model calls

Default Preview retains the separate model check. The explicit Preview-only
request experiment=single (or ?experiment=single in the Preview UI) asks the
writer for its answer and supporting exact source quotes in one response.
Source approval/identity, quotation membership, tools, policy routes and budgets
remain enforced. There is no independent semantic review in this experimental
arm, even when self-checks pass; a kind label or quote is not proof of entailment.
It must not be described as equivalent protection. Production ignores this flag.

Compare the same customer turns with separate histories for each arm. Alternate
which arm goes first; report cache state, number of calls, latency and actual
answer behavior. Retain failures. Do not tune question-specific responses to make
the speed comparison look good. The earlier 36-turn acceptance predates this
experiment and is not claimed as a rerun.

## Google review logging decision

Observed warm append time was roughly 0.15 seconds. Keep the reliable awaited
write to AI_REVIEW rather than introduce a new durable outbox solely to save
that small interval. This remains instrumented and can be reconsidered if its
latency distribution changes. Errors still preserve the customer answer and log
metadata only; drafts remain Ej granskat and cannot approve FAQ. The answer's
provider response ID is recorded, excluding the separate review call's ID.
