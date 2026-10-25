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
    const sandbox = vm.createContext({ lang, langSelect: null, Date, AbortSignal, encodeURIComponent,
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
