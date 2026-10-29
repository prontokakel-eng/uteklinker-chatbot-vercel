import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const source = await fs.readFile(new URL('../public/chat-ui.js', import.meta.url), 'utf8');
// Exercise the real contact renderer and translation table without network or
// unrelated chat controls. A failed refresh must not retain a stale live action.
const translations = source.slice(source.indexOf('const uiCopy ='), source.indexOf('const privacyCopy ='));
const renderer = source.slice(source.indexOf("const contactPanel = document.getElementById('contact-options');"));
test('failed contact refresh is localized and removes stale live actions in four languages', async () => {
  const messages = {
    SE: 'Kontaktinformationen kunde inte hämtas. Försök igen om en stund.',
    DA: 'Kontaktoplysningerne kunne ikke hentes. Prøv igen om lidt.',
    DE: 'Die Kontaktinformationen konnten nicht geladen werden. Bitte versuchen Sie es später erneut.',
    EN: 'Contact information could not be loaded. Please try again shortly.',
  };
  for (const lang of ['SE', 'DA', 'DE', 'EN', 'invalid']) {
    let removed = 0, requests = 0;
    const timers = [];
    const panel = { textContent: 'Stale open status', querySelectorAll: () => [{ remove() { removed++; } }] };
    const sandbox = vm.createContext({ lang, langSelect: null, Date, AbortSignal, encodeURIComponent, window:{addEventListener(){}},
      document: { getElementById: () => panel },
      fetch: async url => { requests++; assert.equal(url, '/api/contact?lang=' + lang); throw Error('Synthetic network failure'); },
      clearTimeout() {}, setTimeout(fn, ms) { timers.push({ fn, ms }); return timers.length; },
    });
    await vm.runInContext(translations + renderer, sandbox);
    assert.equal(requests, 1);
    assert.equal(removed, 1, 'an old phone/chat action must disappear before refresh');
    assert.equal(panel.textContent, messages[lang] || messages.SE, lang);
    assert.equal(timers.length, 1);
    assert.equal(timers[0].ms, 60000);
  }
});

function contactPage(data, { lang = 'SE', clock = Date.parse('2026-10-26T10:00:00Z') } = {}) {
  const timers = [];
  function element(tag) {
    let text = '';
    const node = { tag, children: [], dataset: {}, style: {}, events: {},
      append(...items) { this.children.push(...items); },
      replaceChildren(...items) { text = ''; this.children = items; },
      querySelectorAll() { return this.children.filter(c => c.dataset?.supportAction); },
      setAttribute() {}, addEventListener(name, fn) { this.events[name] = fn; },
    };
    Object.defineProperty(node, 'textContent', { get() { return text + this.children.map(c => c.textContent).join(' '); },
      set(value) { text = value; this.children = []; } });
    return node;
  }
  const panel = element('section');
  class Clock extends Date { static now() { return clock; } }
  const sandbox = vm.createContext({ lang, langSelect: null, Date: Clock, AbortSignal, encodeURIComponent, window:{addEventListener(){}},
    document: { getElementById: () => panel, createElement: element },
    fetch: async () => ({ ok: true, json: async () => data }),
    clearTimeout() {}, setTimeout(fn, ms) { timers.push({ fn, ms }); return timers.length; },
  });
  return { panel, timers, run: () => vm.runInContext(translations + renderer, sandbox) };
}
const contactData = {
  message: 'Synthetic open support', supportOpenNow: true, staffAvailable: true,
  staffMessage: 'Synthetic available staff', supportHoursNote: 'Synthetic hours',
  validUntil: '2026-10-26T10:01:00Z',
  links: [{ type: 'email', href: 'mailto:review@example.com', label: 'Email' },
    { type: 'phone', href: 'tel:+460000000', label: 'Phone' },
    { type: 'chat', href: 'https://example.com/chat', label: 'Chat' }],
};
test('contact renderer handles open, closed, busy and unknown states without pretending staff availability', async () => {
  for (const lang of ['SE', 'DA', 'DE', 'EN']) for (const mode of ['open', 'closed', 'busy', 'unknown']) {
    const data = { ...contactData, supportOpenNow: mode === 'unknown' ? null : mode !== 'closed',
      staffAvailable: mode === 'open',
      links: contactData.links.filter(l => l.type === 'email' || mode === 'open' || (mode === 'busy' && l.type === 'phone')) };
    const page = contactPage(data, { lang }); await page.run();
    assert.deepEqual(page.panel.children.filter(n => n.tag === 'a').map(n => n.href), data.links.map(l => l.href));
  }
});
test('a contact response arriving after expiry cannot show old open status, hours or staff claims', async () => {
  for (const lang of ['SE', 'DA', 'DE', 'EN']) for (const validUntil of ['2026-10-26T10:00:00Z', 'invalid']) {
    const page = contactPage({ ...contactData, validUntil }, { lang }); await page.run();
    assert.doesNotMatch(page.panel.textContent, /Synthetic open|Synthetic hours|Synthetic available/);
    assert.deepEqual(page.panel.children.filter(n => n.tag === 'a').map(n => n.href), ['mailto:review@example.com']);
    assert.ok(page.timers[0].ms >= 60000, 'expired data must not cause a one-second polling loop');
  }
});
