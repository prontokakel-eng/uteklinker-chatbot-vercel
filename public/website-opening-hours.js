// Replace the old automatic Maps/Places loader before enabling this renderer.
// A page-body script cannot undo Google requests already made by a global loader.
(() => {
  const script = document.currentScript;
  if (!script || window.kdServerHoursStarted) return;
  const endpoint = new URL(script.dataset.hoursEndpoint || '/api/opening-hours', script.src || location.href);
  if (endpoint.protocol !== 'https:') return;
  window.kdServerHoursStarted = true;
  let data, timer, expires, pending = false;
  const labels = { SE:['Öppet nu','Stängt','Se öppettider'], DA:['Åbent nu','Lukket','Se åbningstider'], DE:['Jetzt geöffnet','Geschlossen','Öffnungszeiten ansehen'], EN:['Open now','Closed','View opening hours'] };
  const language = {sv:'SE',da:'DA',de:'DE',en:'EN'}[(document.documentElement.lang || 'sv').split('-')[0]] || 'SE';
  function render() {
    clearTimeout(expires);
    const deadlines = [];
    for (const [key, selector] of [['store','[data-kd-hours]'],['support','[data-kd-support]']]) {
      const node = document.querySelector(selector);
      if (!node) continue;
      const state = data?.[key];
      const deadline = Date.parse(state?.validUntil);
      const valid = data?.source === 'google-places' && data.timezone === 'Europe/Stockholm' && Number.isFinite(deadline) && deadline > Date.now() && deadline <= Date.now() + 900000 && typeof state.openNow === 'boolean';
      node.textContent = labels[language][valid ? state.openNow ? 0 : 1 : 2];
      node.dataset.openState = valid ? state.openNow ? 'open' : 'closed' : 'unknown';
      node.title = valid && typeof state.note === 'string' ? state.note : '';
      if (valid) deadlines.push(deadline);
    }
    const attribution = document.querySelector('[data-kd-source]');
    if (attribution) {
      attribution.hidden = deadlines.length === 0; attribution.textContent = 'Google Maps'; attribution.setAttribute('translate','no');
      attribution.href = 'https://www.google.com/maps/search/?api=1&query=Pronto+Klinkerdack+AB&query_place_id=ChIJCdnMWe8KU0YRLbU9Z5ExWEA';
      let providers = document.getElementById('kd-hours-attributions');
      if (!providers) { providers = document.createElement('span'); providers.id = 'kd-hours-attributions'; attribution.parentNode.appendChild(providers); }
      providers.replaceChildren();
      if (deadlines.length) for (const item of data.attributions || []) {
        try {
          const url = new URL(item.href);
          if (url.protocol !== 'https:' || url.username || url.password || typeof item.provider !== 'string') continue;
          const link = document.createElement('a'); link.textContent = item.provider; link.href = url.href; link.target = '_blank'; link.rel = 'noopener noreferrer'; providers.appendChild(link);
        } catch { /* Invalid attribution links are not executable. */ }
      }
    }
    // Drop stale claims at the boundary, including while another request hangs.
    if (deadlines.length) expires = setTimeout(render, Math.max(1, Math.min(...deadlines) - Date.now()));
  }
  async function update() {
    if (pending) return;
    pending = true; clearTimeout(timer);
    try {
      endpoint.searchParams.set('lang', language);
      const response = await fetch(endpoint.href, { credentials:'omit', referrerPolicy:'no-referrer', cache:'no-store', signal:AbortSignal.timeout(10000) });
      if (!response.ok) throw Error('Hours unavailable');
      data = await response.json();
    } catch { data = null; }
    finally { pending = false; render(); timer = setTimeout(update, data?.source === 'google-places' ? 900000 : 60000); }
  }
  function start() { render(); update(); document.addEventListener('visibilitychange', () => { if (!document.hidden) { render(); update(); } }); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',start,{once:true}); else start();
})();
