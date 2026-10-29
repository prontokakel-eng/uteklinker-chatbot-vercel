import test from 'node:test';
import assert from 'node:assert/strict';
import { temporaryContactHours } from '../lib/temporary-contact-hours.js';
import { contactState, getStoreContact } from '../lib/store-contact.js';
import { getWebsiteOpeningHours } from '../lib/website-opening-hours.js';

const env = { GOOGLE_PLACES_ENABLED: 'true', CONTACT_PHONE_VERIFIED: 'true',
  CONTACT_PHONE: '+4640466460', CONTACT_EMAIL_VERIFIED: 'true',
  CONTACT_EMAIL: 'info@example.com', LIVE_CHAT_URL: 'https://example.com/chat',
  LIVE_CHAT_PRESENCE_URL: 'https://example.com/presence' };
const at = iso => temporaryContactHours({ now: new Date(iso) });
test('exception uses inclusive Stockholm dates, then hands back to the existing source', () => {
  assert.equal(at('2026-11-13T22:59:59.999Z'), null);
  assert.equal(at('2026-11-13T23:00:00Z').store.openNow, false);
  assert.equal(at('2026-11-30T22:59:59.999Z').store.openNow, false);
  assert.equal(at('2026-11-30T23:00:00Z'), null);
  const result = contactState({ env, now: new Date('2026-12-01T09:00:00Z'),
    place: { currentOpeningHours: { openNow: true } },
    liveSupport: { openNow: true, validUntil: '2026-12-01T09:15:00Z' } });
  assert.equal(result.supportSource, 'google-places');
  assert.equal(result.supportOpenNow, true); assert.equal(result.openNow, true);
});
test('every date in the exception opens only weekdays 10–12 and expires at closing', () => {
  for (let day = 14; day <= 30; day++) {
    const date = `2026-11-${day}`;
    const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
    const workday = weekday >= 1 && weekday <= 5;
    assert.equal(at(`${date}T08:59:59Z`).support.openNow, false);
    assert.equal(at(`${date}T09:00:00Z`).support.openNow, workday);
    assert.equal(at(`${date}T10:59:59Z`).support.openNow, workday);
    assert.equal(at(`${date}T11:00:00Z`).support.openNow, false);
    if (workday) assert.equal(at(`${date}T10:59:59Z`).validUntil, `${date}T11:00:00.000Z`);
  }
});
test('exception overrides Google, retains phone and email, and keeps staff chat closed even with presence', async () => {
  for (const google of ['true', 'false']) for (const lang of ['SE', 'DA', 'DE', 'EN']) {
    let presence = 0;
    const config = { ...env, GOOGLE_PLACES_ENABLED: google };
    const options = { env: config, lang, placesLoader: async () => ({ status: 'unavailable' }),
      fetcher: async () => { presence++; return { ok: true, json: async () => ({ available: true }) }; } };
    const closed = await getStoreContact({ ...options, now: new Date('2026-11-16T11:00:00Z') });
    assert.equal(closed.openNow, false); assert.equal(closed.staffAvailable, false);
    assert.deepEqual(closed.links.map(link => link.type), ['email']); assert.equal(presence, 0);
    const open = await getStoreContact({ ...options, now: new Date('2026-11-16T09:00:00Z') });
    assert.deepEqual(open.links.map(link => link.type), ['email', 'phone']);
    assert.equal(open.openNow, false); assert.equal(presence, 0); assert.equal(open.staffAvailable, false);
    assert.match(open.supportHoursNote, /2026/);
    assert.equal(open.supportSource, 'owner-approved-temporary');
    const absent = contactState({ env: config, lang, now: new Date('2026-11-16T09:00:00Z'),
      place: { currentOpeningHours: { openNow: true } }, liveSupport: { openNow: false } });
    assert.equal(absent.openNow, false); assert.equal(absent.staffAvailable, false);
    assert.deepEqual(absent.links.map(link => link.type), ['email', 'phone']);
  }
});
test('website and chat use the same exception, without claiming that it comes from Google', async () => {
  for (const iso of ['2026-11-16T09:00:00Z', '2026-11-16T11:00:00Z', '2026-11-28T09:00:00Z']) {
    const now = new Date(iso);
    const web = await getWebsiteOpeningHours({ now, loader: async () => { throw Error('no Google call required'); } });
    const chat = contactState({ now, env });
    assert.equal(web.support.openNow, chat.supportOpenNow);
    assert.equal(web.store.openNow, chat.openNow);
    assert.equal(web.support.validUntil, chat.validUntil);
    assert.equal(web.source, 'owner-approved-temporary');
    assert.deepEqual(web.attributions, []); assert.equal(web.googleMapsUrl, null);
  }
});
test('invalid dates cannot activate the exception', () => {
  assert.equal(temporaryContactHours({ now: new Date('invalid') }), null);
});
