# Product selection in Preview

The discovery flow treats colour, appearance and format as customer preferences.
Once a format and appearance or colour are known, it reads the public shop's
published filter controls. Filter IDs are resolved from those controls, not
hardcoded product names or inferred from generic marketing descriptions.

The adapter submits a fixed, read-only product-list request to the shop's public
catalog renderer. Only filter IDs, pagination and fixed rendering parameters are
sent. Customer messages, session cookies, credentials and contact details are
never forwarded. Public product GETs retain the existing host/path restrictions;
POST redirects are rejected. Robots rules, bounded response sizes, timeouts and
bounded concurrent reads apply. No admin or checkout endpoint is used.

The requested format is tried first. If it returns no product candidates, only
the format filter is removed. Selected appearance and colour remain in place.
A maximum of six candidate pages is checked and at most three products shown.
Alternative sizes are ordered by dimensional proximity, with orientation ignored.
The reply says which products were checked; it does not claim that a format is
absent from the entire shop.

Each displayed size must appear under Information / Nominell storlek in a 20 mm
floor variant. Samples, coping and steps are excluded. Product and classification
sources retain URL, section, timestamp, content hash and site-published status.
Observations expire after five minutes and do not become approved FAQ entries.
The renderer creates safe product links with textContent; no model supplies URLs.

The feature requires WEBSITE_KNOWLEDGE_ENABLED=true and VERCEL_ENV=preview.
No production deployment is enabled. Existing abuse, warranty, structural,
price/stock/delivery and contact gates run before catalog selection. Catalog
failures produce an honest fallback rather than an invented recommendation.
Prices, stock, delivery promises, technical suitability and sample purchase links
are outside this change. A listed format is not a live stock claim.

Tests use synthetic products and controls only. Run tests/product-discovery.test.mjs
alongside the existing customer-flow, knowledge, abuse and language regressions.
Live validation must cover an exact format, an alternative format, safe product
links, and the embedded chat before any separate production approval.
