import { loadPlacesContact, liveSupportState } from './places-contact.js';

// Reuse the existing server-side Places connection. No browser key or customer
// data is sent to Google, and no completed Places response is cached here.
export async function getWebsiteOpeningHours({ env = process.env, loader = loadPlacesContact, now = new Date(), lang = 'SE' } = {}) {
  const unknown = { openNow: null, note: null, validUntil: null };
  let result;
  try { result = await loader({ env, lang }); } catch { /* Unknown is intentional. */ }
  const place = result?.status === 'ready' ? result.place : undefined;
  // Apply the same freshness, timezone and transition checks to store hours.
  // Store hours never substitute for the separate online support hours.
  const store = liveSupportState({ place: place && {
    timeZone: place.timeZone,
    currentSecondaryOpeningHours: place.currentOpeningHours
      ? [{ ...place.currentOpeningHours, secondaryHoursType: 'ONLINE_SERVICE_HOURS' }] : [],
  }, fetchedAt: result?.fetchedAt, now });
  const support = liveSupportState({ place, fetchedAt: result?.fetchedAt, now });
  const states = { store: store || unknown, support: support || unknown };
  const hasSource = Object.values(states).some(state => state.openNow !== null);
  return { ...states, timezone: 'Europe/Stockholm', checkedAt: now.toISOString(),
    source: hasSource ? 'google-places' : null,
    // Fixed click-through link: never auto-load a map or return credentials.
    googleMapsUrl: hasSource ? 'https://www.google.com/maps/search/?api=1&query=Pronto+Klinkerdack+AB&query_place_id=ChIJCdnMWe8KU0YRLbU9Z5ExWEA' : null,
    attributions: hasSource && Array.isArray(place?.attributions) ? place.attributions.flatMap(item => {
      try { const url = new URL(item.providerUri); return typeof item.provider === 'string' && url.protocol === 'https:' && !url.username && !url.password
        ? [{ provider: item.provider, href: url.href }] : []; } catch { return []; }
    }) : [],
  };
}
