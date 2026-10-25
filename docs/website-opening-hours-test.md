# Server-side opening-hours pilot

The storefront currently creates its service bar and starts the Maps JavaScript
loader in the same global script. Adding another script to a page body does not
prevent those earlier requests. Do not enable both implementations.

This pilot reuses `loadPlacesContact` and its existing server configuration. It
introduces no key, Cloud project, schedule or staff-presence inference. Store and
online-service hours are independent. Missing configuration, expired data,
ambiguous support hours and invalid transitions produce unknown status.

## Preview checks

1. Open `/opening-hours-preview.html` in the test deployment.
2. Confirm that no browser request goes to Maps or Places, including before any
   consent. Only the test deployment's `/api/opening-hours` is requested.
3. With the existing approved server connection active for this test deployment,
   compare store and support status with the approved source. Until configured,
   unknown status is the intended result. Never enable a pending key as a shortcut.
4. Verify failed responses, expiry and the first opening/closing boundary.
5. Use a separate unpublished storefront template for the integration: preserve
   the service-bar markup and styling, replace the original automatic loader,
   then load `website-opening-hours.js` with `data-hours-endpoint` set to the
   reviewed test deployment's `/api/opening-hours` URL. Preserve the Maps
   attribution and any provider attributions. The old current-week list renderer
   must also be removed or replaced; this pilot does not infer dates from text.
6. Repeat Cookiebot checks there. Do not change the published shared template or
   claim the live storefront is fixed after testing this standalone page alone.

The API allows browser reads only from the exact HTTPS storefront origins, uses
no credentials, sets `no-store` and rate-limits before calling Places. The
browser renderer sends neither cookies nor referrers and stores no data. Current
server configuration must be verified in Preview separately; code is not proof
that the live connection is enabled.

## Automated regression checks

`node --test tests/website-opening-hours.test.mjs tests/places-contact.test.mjs tests/support-hours.test.mjs`

Fixtures are synthetic. They cover independent store/support states, expiry,
unknown data, exact origins, rate limits and browser credential isolation.
