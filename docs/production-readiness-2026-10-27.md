# Production readiness checkpoint — 27 October 2026

This is a release preparation record, not approval to merge or publish.

## Candidate behavior

The Preview candidate interprets personal-service intent in the existing dialogue
call rather than stopping on warranty/commerce/structural/support words. Those
patterns only disable a potentially sensitive direct FAQ shortcut. Sol can
separate definitions, corrections, negations and topic changes from actual
personal-service requests. The new read-only contact_staff tool returns existing
server-owned policy copy or the verified contact adapter. It sends no message.

Default Preview keeps the separate semantic answer check. The single-call arm
remains an explicit comparison only. Exact quote membership is not proof of
semantic entailment; a small dialogue sample cannot establish equal safety.

The dated November exception now keeps personal chat closed even during the
weekday 10–12 phone window. Existing presence signals cannot reopen it. Store
closure, email and FAQ/AI availability remain as already approved.

## Validation records

Local control-flow/source/storage/abuse regressions: 245 pass, 3 private-workbook
cases explicitly skipped. Lint: zero errors, 13 existing warnings. Fixtures do
not establish the live model's semantic accuracy. The first live 36-turn run at 559555f passed 35 declared flow checks: one
unknown-product answer avoided invention but failed to offer personal service.
That failure is retained, and the general unresolved-product referral rule was
strengthened in the writer and reviewer. One temporary provider HTTP 503 in the
new-dialogue comparison also motivated extending the existing single shared
retry to temporary 500/502/503/504 errors, within unchanged budgets. Live Swedish
dialogue and paired-mode results must be recorded after actual completion; no historical
36-turn acceptance is substituted for this run. Private questions and replies
must remain outside the public repository.

## Remaining release gates

- The prepared Production activation path needs both AI_DIALOGUE_ENABLED=true
  and AI_DIALOGUE_RELEASE_ENABLED=true in server configuration. Neither was set
  in Production. Roll back the engine by setting only AI_DIALOGUE_RELEASE_ENABLED
  to false; keep AI_DIALOGUE_ENABLED=true to retain exact approved editorial
  corrections. Request parameters cannot enable the engine or unchecked arm.
- With AI_DIALOGUE_ENABLED=true, the same two exact editorial revisions and
  binding approval metadata are loaded in either deployment environment. Verify
  source counts under final production settings before release; do not copy FAQ
  text into code or silently restore the old unqualified pool claim on rollback.
- Production signed FAQ snapshots additionally require FAQ_FAST_CACHE_ENABLED=true.
  Otherwise Production uses the authoritative source loader. The existing private
  bucket stores only FAQ, and signed scopes separate environment/build/source pins.
  No Production cache objects or configuration were created by these code changes.
- Verify Production configuration: OpenAI access/model/project, source access,
  pending-review destination, verified contact data, current Places support
  hours and provider spending controls. Old manual hours expire 29 October;
  they must not silently be treated as current. Never copy a browser API key.
- Reconfirm fleet-level protection for chat/contact and the exposed website
  hours endpoint. The local limiter is per-instance; source code does not prove
  current Vercel firewall coverage. Avoid a paid-plan or quota change by default.
- Confirm the published AI privacy section matches the actual history and
  Google review storage, retention and provider settings. The historical draft
  is not final. Redaction is partial, not anonymization.
- Once browser access is restored, test the real staged storefront embed on
  desktop/mobile, before/after cookie choices, with blocked third-party storage,
  and after close/reopen. HTTP checks and simulated DOM tests cannot replace it.
- Before activation, record the current production deployment/configuration and
  an exact rollback target. User approval applies to a concrete reviewed release,
  not to this research branch or the latest moving Preview alias.

No storefront, Production environment, deployment promotion or firewall setting
was changed by this checkpoint. Existing draft PR remains the review surface.
