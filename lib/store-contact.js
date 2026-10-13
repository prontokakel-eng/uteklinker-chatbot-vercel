import { copy } from './customer-copy.js';
export const TIME_ZONE = 'Europe/Stockholm';
export function stockholmTime(date = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: TIME_ZONE, dateStyle: 'short', timeStyle: 'short' }).format(date);
}
function httpsUrl(value) {
  try { const url = new URL(value); return url.protocol === 'https:' ? url.href : null; } catch { return null; }
}
export function contactState({ place, staffAvailable = false, env = process.env, lang = 'SE', now = new Date() } = {}) {
  const words = copy[lang] || copy.SE;
  const openNow = typeof place?.currentOpeningHours?.openNow === 'boolean' && (!place?.timeZone?.id || place.timeZone.id === TIME_ZONE) ? place.currentOpeningHours.openNow : null;
  const email = env.CONTACT_EMAIL_VERIFIED === 'true' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.CONTACT_EMAIL || '') ? env.CONTACT_EMAIL : null;
  const phone = env.CONTACT_PHONE_VERIFIED === 'true' ? env.CONTACT_PHONE : place?.internationalPhoneNumber;
  const tel = phone && /^[+\d\s()-]{6,25}$/.test(phone) ? `tel:${phone.replace(/[^+\d]/g, '')}` : null;
  const liveUrl = httpsUrl(env.LIVE_CHAT_URL);
  const links = [];
  if (email) links.push({ type: 'email', label: words.email, href: `mailto:${email}` });
  if (openNow === true && tel) links.push({ type: 'phone', label: words.phone, href: tel });
  if (openNow === true && staffAvailable && liveUrl) links.push({ type: 'chat', label: words.chat, href: liveUrl });
  return {
    openNow, timezone: TIME_ZONE, localTime: stockholmTime(now),
    message: openNow === true ? words.open : openNow === false ? words.closed : words.unknown,
    staffAvailable: openNow === true && staffAvailable && !!liveUrl,
    staffMessage: openNow === true && !(staffAvailable && liveUrl) ? words.unavailable : null,
    responseNote: email ? (env.CONTACT_RESPONSE_NOTE || words.waiting) : null,
    links, googleMapsUrl: httpsUrl(place?.googleMapsUri), checkedAt: now.toISOString(),
  };
}
export async function getStoreContact({ env = process.env, fetcher = fetch, lang = 'SE' } = {}) {
  let place, staffAvailable = false;
  if (env.GOOGLE_PLACE_ID && env.GOOGLE_PLACES_API_KEY) {
    try {
      const response = await fetcher(`https://places.googleapis.com/v1/places/${encodeURIComponent(env.GOOGLE_PLACE_ID)}?languageCode=sv`, {
        headers: { 'X-Goog-Api-Key': env.GOOGLE_PLACES_API_KEY, 'X-Goog-FieldMask': 'currentOpeningHours,internationalPhoneNumber,googleMapsUri,timeZone' }, signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) throw new Error('Places unavailable');
      place = await response.json();
    } catch { /* Unknown is distinct from closed. */ }
  }
  // A real chat provider must expose staff presence. Never infer presence from store hours.
  const presenceUrl = httpsUrl(env.LIVE_CHAT_PRESENCE_URL);
  if (place?.currentOpeningHours?.openNow === true && presenceUrl) {
    try {
      const response = await fetcher(presenceUrl, { headers: env.LIVE_CHAT_PRESENCE_TOKEN ? { Authorization: `Bearer ${env.LIVE_CHAT_PRESENCE_TOKEN}` } : {}, signal: AbortSignal.timeout(3000) });
      if (response.ok) staffAvailable = (await response.json()).available === true;
    } catch { /* Unavailable until confirmed by provider. */ }
  }
  return contactState({ place, staffAvailable, env, lang });
}
