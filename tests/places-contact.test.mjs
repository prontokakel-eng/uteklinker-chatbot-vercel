import test from 'node:test';
import assert from 'node:assert/strict';
import { createPlacesLoader, liveSupportState } from '../lib/places-contact.js';
import { getStoreContact } from '../lib/store-contact.js';
import handler from '../api/contact.js';

const now = new Date('2026-10-15T10:00:00Z');
const env = { GOOGLE_PLACES_ENABLED: 'true', GOOGLE_PLACE_ID: 'test-place', GOOGLE_PLACES_API_KEY: 'fixture-key', CONTACT_PHONE_VERIFIED: 'true', CONTACT_PHONE: '+4640466460', CONTACT_EMAIL_VERIFIED: 'true', CONTACT_EMAIL: 'info@example.com', LIVE_CHAT_URL: 'https://example.com/chat', LIVE_CHAT_PRESENCE_URL: 'https://example.com/presence' };
const hours = { secondaryHoursType: 'ONLINE_SERVICE_HOURS', openNow: true, nextCloseTime: '2026-10-15T15:00:00Z', weekdayDescriptions: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'] };
const place = { timeZone: { id: 'Europe/Stockholm' }, currentOpeningHours: { openNow: false }, currentSecondaryOpeningHours: [hours], googleMapsUri: 'https://maps.google.com/', attributions: [{ provider: 'Fixture provider', providerUri: 'https://example.com/source' }] };
const ready = value => ({ status: 'ready', place: value, fetchedAt: now.toISOString() });
const state = (value = place, time = now) => liveSupportState({ place: value, fetchedAt: now.toISOString(), now: time });

test('Places requires explicit activation and a server key; PENDING never triggers calls', async () => {
 let calls = 0;
 const load = createPlacesLoader({ fetcher: async () => { calls++; throw Error(); } });
 for (const config of [{ ...env, GOOGLE_PLACES_ENABLED: undefined }, { ...env, GOOGLE_PLACES_ENABLED: 'false' }, { GOOGLE_PLACES_ENABLED: 'true', GOOGLE_PLACE_ID: 'test', GOOGLE_PLACES_API_KEY_PENDING: 'pending' }]) assert.equal((await load({ env: config })).status, 'unavailable');
 assert.equal(calls, 0);
});
test('simultaneous requests coalesce but completed Places content is not cached', async () => {
 let calls = 0, release;
 const load = createPlacesLoader({ clock: () => now.getTime(), fetcher: async (url, options) => {
  calls++; assert.match(url, /languageCode=sv$/); assert.match(options.headers['X-Goog-FieldMask'], /currentSecondaryOpeningHours/);
  assert.equal(options.cache, 'no-store'); await new Promise(resolve => { release = resolve; });
  return { ok: true, json: async () => place };
 } });
 const batch = Array.from({ length: 100 }, () => load({ env }));
 assert.equal(calls, 1); release();
 assert.ok((await Promise.all(batch)).every(result => result.status === 'ready'));
 const next = load({ env }); assert.equal(calls, 2); release(); await next;
});
test('different languages do not share translated content and do not break coalescing', async () => {
 const releases = [], urls = [];
 const load = createPlacesLoader({ fetcher: async url => { urls.push(url); await new Promise(resolve => releases.push(resolve)); return { ok: true, json: async () => place }; } });
 const requests = [load({ env, lang: 'SE' }), load({ env, lang: 'DE' }), load({ env, lang: 'SE' }), load({ env, lang: 'DA' }), load({ env, lang: 'EN' })];
 assert.equal(urls.length, 4); assert.deepEqual(urls.map(url => new URL(url).searchParams.get('languageCode')), ['sv', 'de', 'da', 'en']);
 releases.forEach(release => release()); await Promise.all(requests);
});
test('Google failures back off without retaining error bodies or serving stale content', async () => {
 let time = now.getTime(), calls = 0;
 const load = createPlacesLoader({ clock: () => time, fetcher: async () => { calls++; return { ok: false }; } });
 assert.deepEqual(await load({ env }), { status: 'unavailable' });
 await load({ env }); assert.equal(calls, 1);
 time += 30000; await load({ env }); assert.equal(calls, 2);
});
test('only one current ONLINE_SERVICE_HOURS entry can authorize support', () => {
 assert.equal(state().openNow, true);
 for (const value of [{ ...place, currentSecondaryOpeningHours: undefined }, { ...place, currentSecondaryOpeningHours: {} }, { ...place, currentSecondaryOpeningHours: [{ ...hours, secondaryHoursType: 'DELIVERY' }] }, { ...place, currentSecondaryOpeningHours: [hours, hours] }, { ...place, timeZone: { id: 'UTC' } }, { ...place, timeZone: undefined }]) assert.equal(state(value).openNow, null);
});
test('stale or invalid live status cannot reuse an old openNow boolean', () => {
 assert.equal(state(place, new Date('2026-10-15T10:15:00Z')).openNow, null);
 assert.equal(liveSupportState({ place, fetchedAt: 'invalid', now }).openNow, null);
 assert.equal(liveSupportState({ place, fetchedAt: '2026-10-15T11:00:00Z', now }).openNow, null);
});
test('a closing boundary expires contact actions before the 15-minute refresh', () => {
 const value = { ...place, currentSecondaryOpeningHours: [{ ...hours, nextCloseTime: '2026-10-15T10:02:00Z' }] };
 assert.equal(state(value).validUntil, '2026-10-15T10:02:00.000Z');
 assert.equal(state(value, new Date('2026-10-15T10:02:00Z')).openNow, null);
 assert.equal(state({ ...place, currentSecondaryOpeningHours: [{ ...hours, nextCloseTime: undefined }] }).openNow, null);
});
test('support can be open with the store closed; actual staff presence remains required', async () => {
 for (const lang of ['SE', 'DA', 'DE', 'EN']) {
  let presence = 0;
  const result = await getStoreContact({ env, lang, now, placesLoader: async () => ready(place), fetcher: async () => { presence++; return { ok: true, json: async () => ({ available: true }) }; } });
  assert.equal(result.openNow, false); assert.equal(result.supportOpenNow, true); assert.equal(presence, 1);
  assert.deepEqual(result.links.map(link => link.type), ['email', 'phone', 'chat']);
  assert.equal(result.supportSource, 'google-places'); assert.equal(result.supportHoursNote, hours.weekdayDescriptions.join(' · '));
  assert.deepEqual(result.attributions, [{ provider: 'Fixture provider', href: 'https://example.com/source' }]);
  assert.ok(!JSON.stringify(result).includes('fixture-key'));
 }
 const noStaff = await getStoreContact({ env, now, placesLoader: async () => ready(place), fetcher: async () => { throw Error(); } });
 assert.equal(noStaff.staffAvailable, false); assert.deepEqual(noStaff.links.map(link => link.type), ['email', 'phone']);
});
test('closed Google support overrides open store and the manual snapshot', async () => {
 let presence = 0;
 const value = { ...place, currentOpeningHours: { openNow: true }, currentSecondaryOpeningHours: [{ ...hours, openNow: false, nextOpenTime: '2026-10-16T08:00:00Z' }] };
 const result = await getStoreContact({ env, now, placesLoader: async () => ready(value), fetcher: async () => { presence++; throw Error(); } });
 assert.equal(result.supportOpenNow, false); assert.equal(result.openNow, true); assert.equal(presence, 0);
 assert.deepEqual(result.links.map(link => link.type), ['email']);
});
test('missing support, failed and malformed responses fail closed without manual/store fallback', async () => {
 for (const loader of [async () => ({ status: 'unavailable' }), async () => ready({ ...place, currentSecondaryOpeningHours: [] }), async () => { throw Error(); }]) {
  const result = await getStoreContact({ env, now, placesLoader: loader, fetcher: async () => { throw Error('must not check staff'); } });
  assert.equal(result.supportOpenNow, null); assert.equal(result.supportHoursNote, null); assert.equal(result.staffAvailable, false);
  assert.deepEqual(result.links.map(link => link.type), ['email']);
 }
});
test('contact endpoint rejects unsupported methods and throttles independently of chat', async () => {
 const res = () => ({ headers: {}, setHeader(key, value) { this.headers[key] = value; }, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });
 const post = res(); await handler({ method: 'POST' }, post); assert.equal(post.code, 405);
 for (let index = 0; index < 11; index++) { const response = res(); await handler({ method: 'GET', headers: { 'x-forwarded-for': '192.0.2.250' } }, response); assert.equal(response.code, index < 10 ? 200 : 429); if (index === 10) assert.ok(Number(response.headers['Retry-After']) > 0); }
 const other = res(); await handler({ method: 'GET', headers: { 'x-forwarded-for': '192.0.2.251' } }, other); assert.equal(other.code, 200); assert.equal(other.headers['Cache-Control'], 'no-store');
});

test('contact throttling rejects requests before Google even when language changes', async () => {
 // A fresh process installs the fake fetch before the production loader captures it.
 // No test request is allowed to leave this process.
 const { spawnSync } = await import('node:child_process');
 const endpoint = new URL('../api/contact.js', import.meta.url).href;
 const script = `
  import assert from 'node:assert/strict';
  let googleCalls = 0;
  globalThis.fetch = async url => {
   assert.equal(new URL(url).hostname, 'places.googleapis.com');
   googleCalls++;
   return { ok: true, json: async () => ({ currentSecondaryOpeningHours: [] }) };
  };
  const { default: handler } = await import(${JSON.stringify(endpoint)});
  const res = () => ({ headers: {}, setHeader(key, value) { this.headers[key] = value; }, status(code) { this.code = code; return this; }, json(body) { this.body = body; return this; } });
  const request = lang => ({ method: 'GET', headers: { 'x-forwarded-for': '192.0.2.252' }, query: { lang } });
  const post = res(); await handler({ method: 'POST' }, post);
  assert.equal(post.code, 405); assert.equal(googleCalls, 0);
  for (let index = 0; index < 10; index++) {
   const response = res(); await handler(request(['SE', 'DA', 'DE', 'EN'][index % 4]), response);
   assert.equal(response.code, 200);
  }
  assert.equal(googleCalls, 10);
  for (const lang of ['SE', 'DA', 'DE', 'EN', 'invalid']) {
   const blocked = res(); await handler(request(lang), blocked);
   assert.equal(blocked.code, 429);
   assert.ok(Number(blocked.headers['Retry-After']) > 0);
   assert.equal(blocked.headers['Cache-Control'], 'no-store');
   assert.equal(googleCalls, 10, 'blocked request must never reach Google');
   assert.ok(!JSON.stringify(blocked.body).includes('fixture-key'));
  }
 `;
 const child = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
  encoding: 'utf8', timeout: 5000,
  env: { ...process.env, GOOGLE_PLACES_ENABLED: 'true', GOOGLE_PLACE_ID: 'fixture-place', GOOGLE_PLACES_API_KEY: 'fixture-key' },
 });
 assert.equal(child.status, 0, child.stderr || child.error?.message);
});
