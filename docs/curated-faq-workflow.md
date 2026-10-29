# Delegated editorial FAQ review

The owner explicitly authorized review of saved AI replies and promotion of
relevant, verified answers. This is an editorial action under that delegation,
not model self-approval or a claim that a human inspected each row.

AI_REVIEW remains an archive of AI-origin drafts. Original questions, answers,
provider IDs and origin are retained. Reviews distinguish conversational relevance,
existing FAQ coverage, edited source material and rejected replies. Customer
measurements, preferences, search misses and follow-up questions do not become
universal FAQ facts.

The editor checks references, removes conversation-specific details and writes a
new standalone manual entry in FAQ_SE_CURATED. It records the final question and
answer, external source, reviewer, source date, original draft rows and a hash
binding language/content/source identity. Raw AI rows remain excluded even when
their review status changes. The reviewer is explicitly recorded as Codex acting
under the owner's delegation, not as Christian or a human reviewer.

The runtime reads the editorial tab alongside the existing qualified pool
revisions in one batch, overlapping that read with the independent Drive source
load. Only approved, unchanged manual rows with the editorial identity/location
are merged; duplicate identities are rejected. The original four-language FAQ
sources are not rewritten. Normal source freshness and snapshot signing apply.

A policy-sensitive term can use an exact approved editorial question at a new
conversation's start. This is exact only: fuzzy/mixed sizing questions still go
to Sol. All ongoing conversations and refinement requests continue through Sol.
No query-specific answer text is stored in the repository. Private factual
content and review decisions remain in the authorized Google workbook.

## Latency interpretation

Independent curl transfers to a cached static page took about 6–8 seconds from
this execution environment, mainly during TLS setup. In a single curl process,
the first static transfer took 8.52 seconds, including 8.20 seconds to establish
TLS; the next transfer reused the connection and took 0.155 seconds with zero
new TLS setup. These are test-network observations, not customer browser latency
or a proof about Vercel's internal cold starts. Do not attribute that entire gap
to the model or FAQ. Retain separate handler timings and measure the final
browser integration before declaring an end-user latency target met.

Warm in-memory FAQ is already local to the running function. The private signed
snapshot avoids repeated heavy source parsing across functions. Parallel
editorial reads reduce the critical path of a genuine cache refresh, without
extending the source approval freshness window or committing private facts.
