import { temporaryContactHours } from './temporary-contact-hours.js';
import { copy } from './customer-copy.js';
import { supportOpenNow, supportCopy, supportHoursNote } from './support-hours.js';
import { placesEnabled, createPlacesLoader, loadPlacesContact, liveSupportState } from './places-contact.js';
export const TIME_ZONE = 'Europe/Stockholm';
export function stockholmTime(date = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: TIME_ZONE, dateStyle: 'short', timeStyle: 'short' }).format(date);
}
function httpsUrl(value) {
  try { const url = new URL(value); return url.protocol === 'https:' ? url.href : null; } catch { return null; }
}
export function contactState({ place, liveSupport, staffAvailable = false, env = process.env, lang = 'SE', now = new Date() } = {}) {
  const words = copy[lang] || copy.SE;
  const supportWords = supportCopy[lang] || supportCopy.SE;
  const usePlaces = placesEnabled(env);
  const temporary = temporaryContactHours({ now, lang });
  const supportIsOpen = temporary ? temporary.support.openNow : usePlaces ? (liveSupport?.openNow ?? null) : supportOpenNow({ env, now });
  const openNow = temporary ? false : typeof place?.currentOpeningHours?.openNow === 'boolean' && (!place?.timeZone?.id || place.timeZone.id === TIME_ZONE) ? place.currentOpeningHours.openNow : null;
  const email = env.CONTACT_EMAIL_VERIFIED === 'true' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(env.CONTACT_EMAIL || '') ? env.CONTACT_EMAIL : null;
  const phone = env.CONTACT_PHONE_VERIFIED === 'true' ? env.CONTACT_PHONE : place?.internationalPhoneNumber;
  const tel = phone && /^[+\d\s()-]{6,25}$/.test(phone) ? `tel:${phone.replace(/[^+\d]/g, '')}` : null;
  const liveUrl = temporary?.staffChatClosed ? null : httpsUrl(env.LIVE_CHAT_URL);
  const links = [];
  if (email) links.push({ type: 'email', label: words.email, href: `mailto:${email}` });
  if (supportIsOpen === true && tel) links.push({ type: 'phone', label: words.phone, href: tel });
  if (supportIsOpen === true && staffAvailable && liveUrl) links.push({ type: 'chat', label: words.chat, href: liveUrl });
  return {
    openNow, timezone: TIME_ZONE, localTime: stockholmTime(now),
    supportOpenNow: supportIsOpen,
    supportHoursNote: temporary ? temporary.note : usePlaces ? (liveSupport?.note ?? null) : supportHoursNote({ env, lang, now }),
    supportSource: temporary ? temporary.source : usePlaces ? 'google-places' : 'verified-manual',
    validUntil: temporary ? temporary.validUntil : usePlaces ? (liveSupport?.validUntil ?? null) : null,
    refreshAfterMs: usePlaces ? 900000 : 60000,
    attributions: usePlaces && Array.isArray(place?.attributions) ? place.attributions.filter(item => typeof item?.provider === 'string' && httpsUrl(item.providerUri)).map(item => ({ provider: item.provider, href: httpsUrl(item.providerUri) })) : [],
    message: supportIsOpen === true ? supportWords.open : supportIsOpen === false ? supportWords.closed : supportWords.unknown,
    storeMessage: openNow === true ? words.open : openNow === false ? words.closed : words.unknown,
    staffAvailable: supportIsOpen === true && staffAvailable && !!liveUrl,
    staffMessage: supportIsOpen === true && !(staffAvailable && liveUrl) ? words.unavailable : null,
    responseNote: email ? (env.CONTACT_RESPONSE_NOTE || words.waiting) : null,
    links, googleMapsUrl: httpsUrl(place?.googleMapsUri), checkedAt: now.toISOString(),
  };
}
export async function getStoreContact({ env = process.env, fetcher = fetch, placesLoader, lang = 'SE', now = new Date() } = {}) {
  let place, staffAvailable = false;
  let liveSupport;
  if (placesEnabled(env)) {
    const loader = placesLoader || (fetcher === fetch ? loadPlacesContact : createPlacesLoader({ fetcher, clock: () => now.getTime() }));
    try {
      const result = await loader({ env, lang });
      place = result?.status === 'ready' ? result.place : undefined;
      liveSupport = liveSupportState({ place, fetchedAt: result?.fetchedAt, now });
    } catch { /* Keep live support unknown; never fall back to store/manual hours. */ }
  }
  // A real chat provider must expose staff presence. Never infer presence from store hours.
  const presenceUrl = httpsUrl(env.LIVE_CHAT_PRESENCE_URL);
  if (!temporaryContactHours({ now, lang })?.staffChatClosed && (temporaryContactHours({ now, lang })?.support.openNow ?? (placesEnabled(env) ? liveSupport?.openNow : supportOpenNow({ env, now }))) === true && presenceUrl) {
    try {
      const response = await fetcher(presenceUrl, { headers: env.LIVE_CHAT_PRESENCE_TOKEN ? { Authorization: `Bearer ${env.LIVE_CHAT_PRESENCE_TOKEN}` } : {}, signal: AbortSignal.timeout(3000) });
      if (response.ok) staffAvailable = (await response.json()).available === true;
    } catch { /* Unavailable until confirmed by provider. */ }
  }
  return contactState({ place, liveSupport, staffAvailable, env, lang, now });
}

