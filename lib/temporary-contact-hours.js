// Owner-approved exception. Both bounds are Stockholm midnight (CET).
// Outside this period, the existing Places/manual flow remains responsible.
const START = Date.parse('2026-11-14T00:00:00+01:00');
const END = Date.parse('2026-12-01T00:00:00+01:00');
export function temporaryContactHours({ now = new Date(), lang = 'SE' } = {}) {
  const time = now.getTime();
  if (!(time >= START && time < END)) return null;
  const local = new Date(time + 3600000); // This bounded period is entirely CET.
  const weekday = local.getUTCDay();
  const minute = local.getUTCHours() * 60 + local.getUTCMinutes();
  const openNow = weekday >= 1 && weekday <= 5 && minute >= 600 && minute < 720;
  const boundary = new Date(time);
  boundary.setUTCHours(minute < 600 ? 9 : 11, 0, 0, 0);
  const deadline = Math.min(time + 900000, END,
    weekday >= 1 && weekday <= 5 && minute < 720 ? boundary.getTime() : END);
  const validUntil = new Date(deadline).toISOString();
  const notes = {
    SE: '14–30 november 2026: butiken är stängd. Telefonrådgivning måndag–fredag 10–12, svensk tid. Personlig chatt är stängd. AI-chatten och e-post är fortsatt tillgängliga.',
    DA: '14.–30. november 2026: Butikken er lukket. Telefonrådgivning mandag–fredag kl. 10–12, svensk tid. Personlig chat er lukket. AI-chat og e-mail er fortsat tilgængelige.',
    DE: '14.–30. November 2026: Das Geschäft ist geschlossen. Telefonberatung Montag–Freitag 10–12 Uhr, schwedische Zeit. Der persönliche Chat ist geschlossen. KI-Chat und E-Mail bleiben verfügbar.',
    EN: '14–30 November 2026: the store is closed. Phone advice Monday–Friday 10:00–12:00, Swedish time. Staff chat is closed. AI chat and email remain available.',
  };
  const note = notes[lang] || notes.SE;
  return { source: 'owner-approved-temporary', note, validUntil, staffChatClosed: true,
    support: { openNow, note, validUntil },
    store: { openNow: false, note, validUntil } };
}
