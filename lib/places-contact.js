const FIELD_MASK = 'currentOpeningHours,currentSecondaryOpeningHours,timeZone,googleMapsUri,attributions';
export function placesEnabled(env = process.env) {
  return env.GOOGLE_PLACES_ENABLED === 'true';
}

// Coalesce only requests that are in flight. Do not retain Places content after
// completion: a cross-customer opening-hours cache is not assumed to be permitted.
export function createPlacesLoader({ fetcher = fetch, clock = Date.now } = {}) {
  let signature;
  const pending = new Map(), retryAfter = new Map();
  return function load({ env = process.env, lang = 'SE' } = {}) {
    if (!placesEnabled(env) || !env.GOOGLE_PLACE_ID || !env.GOOGLE_PLACES_API_KEY) return Promise.resolve({ status: 'unavailable' });
    const language = { SE: 'sv', DA: 'da', DE: 'de', EN: 'en' }[lang] || 'sv';
    const key = JSON.stringify([env.GOOGLE_PLACE_ID, env.GOOGLE_PLACES_API_KEY]);
    if (signature !== key) { pending.clear(); retryAfter.clear(); signature = key; }
    if (pending.has(language)) return pending.get(language);
    if (clock() < (retryAfter.get(language) || 0)) return Promise.resolve({ status: 'unavailable' });
    const request = (async () => {
      try {
        const response = await fetcher(`https://places.googleapis.com/v1/places/${encodeURIComponent(env.GOOGLE_PLACE_ID)}?languageCode=${language}`, {
          headers: { 'X-Goog-Api-Key': env.GOOGLE_PLACES_API_KEY, 'X-Goog-FieldMask': FIELD_MASK },
          signal: AbortSignal.timeout(5000), cache: 'no-store',
        });
        if (!response.ok) throw new Error('Places unavailable');
        const place = await response.json();
        if (!place || typeof place !== 'object' || Array.isArray(place)) throw new Error('Invalid Places response');
        return { status: 'ready', place, fetchedAt: new Date(clock()).toISOString() };
      } catch {
        // Store only retry metadata, never error bodies or keys.
        if (signature === key) retryAfter.set(language, clock() + 30000);
        return { status: 'unavailable' };
      }
    })();
    pending.set(language, request);
    void request.finally(() => { if (pending.get(language) === request) pending.delete(language); });
    return request;
  };
}
export const loadPlacesContact = createPlacesLoader();

export function liveSupportState({ place, fetchedAt, now = new Date() } = {}) {
  const unknown = { openNow: null, note: null, validUntil: null };
  if (place?.timeZone?.id !== 'Europe/Stockholm') return unknown;
  const matches = Array.isArray(place?.currentSecondaryOpeningHours) ? place.currentSecondaryOpeningHours.filter(hours => hours?.secondaryHoursType === 'ONLINE_SERVICE_HOURS') : [];
  if (matches?.length !== 1 || typeof matches[0].openNow !== 'boolean') return unknown;
  const hours = matches[0];
  const fetched = Date.parse(fetchedAt);
  const current = now.getTime();
  if (!Number.isFinite(fetched) || fetched > current + 5000 || current - fetched >= 900000) return unknown;
  let deadline = fetched + 900000;
  const transition = hours.openNow ? hours.nextCloseTime : hours.nextOpenTime;
  if (hours.openNow && !transition) return unknown;
  if (transition) {
    const time = Date.parse(transition);
    if (!Number.isFinite(time) || time <= current) return unknown;
    deadline = Math.min(deadline, time);
  }
  const note = Array.isArray(hours.weekdayDescriptions) && hours.weekdayDescriptions.length === 7 && hours.weekdayDescriptions.every(line => typeof line === 'string' && line.length <= 250)
    ? hours.weekdayDescriptions.join(' · ') : null;
  return { openNow: hours.openNow, note, validUntil: new Date(deadline).toISOString() };
}
