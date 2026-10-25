// The host can serve this launcher locally and set data-chat-url to the chat URL.
// Loading an externally hosted launcher itself still makes a request to that host.
(() => {
  const script = document.currentScript;
  if (!script || document.getElementById('pronto-chat-toggle')) return;
  const chatUrl = new URL(script.dataset.chatUrl || '/', script.src || location.href);
  if (chatUrl.protocol !== 'https:') return;
  function mount() {
    if (document.getElementById('pronto-chat-toggle')) return;
    const button = document.createElement('button');
    button.id = 'pronto-chat-toggle';
    button.type = 'button';
    button.textContent = 'Fråga oss';
    button.setAttribute('aria-expanded', 'false');
    button.setAttribute('aria-controls', 'pronto-chat-frame');
    Object.assign(button.style, { position: 'fixed', bottom: '20px', right: '20px', zIndex: '9999', padding: '10px 16px', borderRadius: '50px', border: 'none', background: '#2f5d50', color: '#fff', cursor: 'pointer' });
    let frame, expanded = false;
    function close() {
      frame?.remove(); frame = undefined; expanded = false;
      button.textContent = 'Fråga oss'; button.setAttribute('aria-expanded', 'false');
      button.focus?.();
    }
    function resize() {
      Object.assign(frame.style, expanded
        ? { width: 'min(580px, calc(100vw - 32px))', height: 'min(820px, calc(100dvh - 110px))' }
        : { width: 'min(400px, calc(100vw - 32px))', height: 'min(660px, calc(100dvh - 110px))' });
    }
    window.addEventListener('message', event => {
      if (!frame || event.source !== frame.contentWindow || event.origin !== chatUrl.origin) return;
      if (event.data?.type === 'pronto-chat:close') close();
      else if (event.data?.type === 'pronto-chat:toggle-size') { expanded = !expanded; resize(); }
    });
    button.addEventListener('click', () => {
      if (frame) {
        close();
        return;
      }
      frame = document.createElement('iframe');
      frame.id = 'pronto-chat-frame';
      frame.title = 'Pronto Klinkerdäck – AI-assistent';
      frame.referrerPolicy = 'no-referrer';
      frame.src = chatUrl.href;
      Object.assign(frame.style, { position: 'fixed', bottom: '76px', right: '20px', width: 'min(400px, calc(100vw - 40px))', height: 'min(600px, calc(100dvh - 110px))', border: 'none', borderRadius: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.2)', zIndex: '9999' });
      resize();
      document.body.appendChild(frame);
      button.textContent = 'Stäng chatten (rensa samtalet)';
      button.setAttribute('aria-expanded', 'true');
    });
    document.body.appendChild(button);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount, { once: true });
  else mount();
})();
