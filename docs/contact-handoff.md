# Personal-service handoff

When a customer requests personal help with an unresolved product fact, the
support tool used to end the turn with only opening status and support hours.
The reason for the referral disappeared and the customer had to find a separate
contact control outside the reply.

The support tool now includes a customer-facing explanation and personal-service
offer in its read-only selection. That generated reply follows the existing
semantic review, revision and failure boundaries without another generation
call. The controller keeps
the same generation, tool, token and deadline limits. A separate opening_hours
reason retains deterministic verified hours; warranty, commerce and structural
requests retain their existing server-owned policy replies.

Every CONTACT reply has an in-bubble button opening the existing contact panel.
Opening refreshes the panel's verified contact options. The delegated button
handler works for replies added after page startup and restores focus on close.
No product names, reply facts, contact details or hours are supplied by this UI
change. Nothing is sent to staff. Closed, busy, unknown and expired states use
the existing contact renderer and its action-expiry rules.

Local validation: 250 tests pass, 3 private-workbook tests are explicitly skipped;
lint has no errors and 13 existing warnings. Synthetic tests cover preservation
of the reviewed explanation, rejection of unsupported contact drafts, dynamic
contact actions and contact-state expiry. Live Preview behavior must also be
checked before release; mocks do not establish semantic model accuracy.

Production activation, storefront changes and PR merging remain separate release
decisions. The earlier contact-button failure is retained in the private release
notes and is not counted as a successful handoff.
