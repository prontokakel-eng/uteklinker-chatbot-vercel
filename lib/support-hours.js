// Explicit support schedule, independent of the store's Google opening hours.
// Server configuration: { weekly: { "1": [["10:00", "17:00"]], ... },
// exceptions: { "2026-12-25": [] } }. ISO weekdays: Monday=1, Sunday=7.
// Every weekday must be supplied; [] means closed. Missing/invalid data is unknown.
// Temporary snapshot read from this profile's separate "Online service hours"
// in Google Maps on 2026-10-15. This is not an automatic Google API sync.
// Expire rather than silently rely on an old snapshot while API approval is pending.
export const verifiedSupportHours = {
  source: 'https://www.google.com/maps/search/?api=1&query=Pronto+Klinkerdack+AB&query_place_id=ChIJCdnMWe8KU0YRLbU9Z5ExWEA',
  verifiedOn: '2026-10-15', validUntil: '2026-10-29T00:00:00Z',
  weekly: { 1: [['10:00', '17:00']], 2: [['10:00', '17:00']], 3: [['10:00', '17:00']], 4: [['10:00', '17:00']], 5: [['10:00', '16:00']], 6: [], 7: [] },
};
export function supportOpenNow({ env = process.env, now = new Date() } = {}) {
  try {
    const hasOverride = env.SUPPORT_HOURS_JSON !== undefined;
    if ((hasOverride && env.SUPPORT_HOURS_VERIFIED !== 'true') || env.SUPPORT_HOURS_VERIFIED === 'false') return null;
    const schedule = hasOverride ? JSON.parse(env.SUPPORT_HOURS_JSON) : verifiedSupportHours;
    if (schedule.validUntil && (!Number.isFinite(Date.parse(schedule.validUntil)) || now.getTime() >= Date.parse(schedule.validUntil))) return null;
    const validTime = value => typeof value === 'string' && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
    const validIntervals = intervals => Array.isArray(intervals) && intervals.every(pair =>
      Array.isArray(pair) && pair.length === 2 && pair.every(validTime) && pair[0] < pair[1]);
    if (!schedule || !schedule.weekly || !Array.from({ length: 7 }, (_, i) => i + 1).every(day => validIntervals(schedule.weekly[day]))) return null;
    if (schedule.exceptions !== undefined && (!schedule.exceptions || typeof schedule.exceptions !== 'object' || Array.isArray(schedule.exceptions))) return null;
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Stockholm', year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(now).map(part => [part.type, part.value]));
    const date = `${parts.year}-${parts.month}-${parts.day}`;
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay() || 7;
    const intervals = Object.hasOwn(schedule.exceptions || {}, date) ? schedule.exceptions[date] : schedule.weekly[weekday];
    if (!validIntervals(intervals)) return null;
    const time = `${parts.hour}:${parts.minute}`;
    return intervals.some(([start, end]) => start <= time && time < end);
  } catch { return null; }
}

export const supportCopy = {
  SE: { open: 'Supporten är öppen.', closed: 'Supporten är stängd. FAQ och AI svarar dygnet runt.', unknown: 'Supporttiderna kan inte verifieras just nu. FAQ och AI svarar dygnet runt.' },
  DA: { open: 'Kundesupport er åben.', closed: 'Kundesupport er lukket. FAQ og AI svarer døgnet rundt.', unknown: 'Supporttiderne kan ikke bekræftes lige nu. FAQ og AI svarer døgnet rundt.' },
  DE: { open: 'Der Kundensupport ist erreichbar.', closed: 'Der Kundensupport ist geschlossen. FAQ und KI antworten rund um die Uhr.', unknown: 'Die Supportzeiten können gerade nicht bestätigt werden. FAQ und KI antworten rund um die Uhr.' },
  EN: { open: 'Customer support is open.', closed: 'Customer support is closed. FAQ and AI answers are available around the clock.', unknown: 'Support hours cannot be verified right now. FAQ and AI answers are available around the clock.' },
};

export function supportHoursNote({ env = process.env, lang = 'SE', now = new Date() } = {}) {
  if (env.SUPPORT_HOURS_JSON !== undefined || supportOpenNow({ env, now }) === null) return null;
  const labels = {
    SE: 'Support och telefon: måndag–torsdag 10–17, fredag 10–16. Stängt lördag–söndag. Svensk tid.',
    DA: 'Support og telefon: mandag–torsdag 10–17, fredag 10–16. Lukket lørdag–søndag. Svensk tid.',
    DE: 'Support und Telefon: Montag–Donnerstag 10–17 Uhr, Freitag 10–16 Uhr. Samstag–Sonntag geschlossen. Schwedische Zeit.',
    EN: 'Support and phone: Monday–Thursday 10:00–17:00, Friday 10:00–16:00. Closed Saturday–Sunday. Swedish time.',
  };
  return labels[lang] || labels.SE;
}
