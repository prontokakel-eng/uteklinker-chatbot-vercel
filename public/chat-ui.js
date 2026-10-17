// client/chat-ui.js — UPDATED: generic auto-language banner for all languages
const messagesDiv = document.getElementById("messages");
const messageScroller = document.querySelector('.chat-container') || messagesDiv;
const input = document.getElementById("user-input") || document.getElementById("userInput");
const sendBtn = document.getElementById("send-btn") || document.getElementById("sendButton");
const langSelect = document.getElementById("langSelect");

const langBanner = document.getElementById("langBanner");
const faqBanner = document.getElementById("faqBanner");
const saveBanner = document.getElementById("saveBanner");
const statusBanner = document.getElementById("statusBanner");
const loader = document.getElementById("loader");
const thinkingSr = document.getElementById("thinkingSr");
const undoBanner = document.getElementById("undoBanner");
const undoBtn = document.getElementById("undoBtn");

const enterToggle = document.getElementById("enter-toggle");
const enterHelp = document.getElementById("enter-help");
const newChatBtn = document.getElementById("new-chat-btn");
const jumpBtn = document.getElementById("jump-btn");
const listTgl = document.getElementById("list-toggle");

const flagButtons = Array.from(document.querySelectorAll(".lang-switch .flag"));
const voiceBtn = document.getElementById("voice-btn");
const copyBtn  = document.getElementById("copy-btn");
const soundBtn = document.getElementById("sound-btn");
const uiCopy = {
  SE: { input: 'Skriv ett meddelande...', retry: 'Försök igen', refine: 'Utveckla svaret', help: 'Skicka med Enter eller sändknappen.' },
  EN: { input: 'Type a message...', retry: 'Try again', refine: 'Explain in more detail', help: 'Send with Enter or the send button.' },
  DA: { input: 'Skriv en besked...', retry: 'Prøv igen', refine: 'Uddyb svaret', help: 'Send med Enter eller send-knappen.' },
  DE: { input: 'Nachricht eingeben...', retry: 'Erneut versuchen', refine: 'Antwort erläutern', help: 'Mit Enter oder der Senden-Taste senden.' },
};
const privacyCopy = {
  SE: 'Du chattar med en AI-assistent. Text kan behandlas av OpenAI. Skriv inte personnummer, betalningsuppgifter eller känsliga uppgifter. Svaren kan innehålla fel.',
  DA: 'Du chatter med en AI-assistent. Tekst kan blive behandlet af OpenAI. Skriv ikke CPR-nummer, betalingsoplysninger eller følsomme oplysninger. Svarene kan indeholde fejl.',
  DE: 'Sie chatten mit einem KI-Assistenten. Texte können von OpenAI verarbeitet werden. Geben Sie keine persönlichen Identifikationsnummern, Zahlungsdaten oder sensiblen Daten ein. Antworten können Fehler enthalten.',
  EN: 'You are chatting with an AI assistant. Text may be processed by OpenAI. Do not enter personal identification numbers, payment details or sensitive information. Answers may contain errors.',
};

const privacyLinkCopy = {
  SE: 'Integritet och säkerhet (svenska)',
  DA: 'Privatliv og sikkerhed (på svensk)',
  DE: 'Datenschutz und Sicherheit (auf Schwedisch)',
  EN: 'Privacy and security (in Swedish)',
};

function showBanner(element, text, timeout = 3000) {
  if (!element) return;
  element.textContent = text;
  element.style.display = "block";
  setTimeout(() => (element.style.display = "none"), timeout);
}
function hideLoader(){ if (loader) loader.classList.add("hidden"); }
function showLoader(){ if (loader) loader.classList.remove("hidden"); }

function updateEnterHelp() {
  if (!enterHelp) return;
  const enterSends = !enterToggle || enterToggle.checked;
  enterHelp.innerHTML = enterSends
    ? 'Tips: Du kan skicka meddelanden med <strong>Enter</strong> eller ➤-knappen.'
    : 'Tips: Använd <strong>Shift+Enter</strong> för radbrytning, och ➤ för att skicka.';
}

function escapeHTML(s){ return s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;'); }
function renderMarkdown(text){
  let html = escapeHTML(text);
  html = html.replace(/```([\s\S]*?)```/g, (_,code)=>`<pre><code>${escapeHTML(code)}</code></pre>`);
  html = html.replace(/`([^`]+)`/g, (_,c)=>`<code>${escapeHTML(c)}</code>`);
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/_([^_]+)_/g, '<em>$1</em>');
  html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  return html;
}
function enhanceCodeBlocks(container){
  container.querySelectorAll('pre').forEach(pre=>{
    if (pre.querySelector('.copy-code')) return;
    const btn = document.createElement('button');
    btn.className = 'btn copy-code';
    btn.type = 'button';
    btn.textContent = 'Kopiera';
    btn.style.float = 'right';
    btn.addEventListener('click', async ()=>{
      try { await navigator.clipboard.writeText(pre.innerText); btn.textContent = 'Kopierat ✓'; setTimeout(()=>btn.textContent='Kopiera',1200); }
      catch { btn.textContent='Fel'; setTimeout(()=>btn.textContent='Kopiera',1200); }
    });
    pre.prepend(btn);
  });
}

function toDisplay(val) {
  if (val == null) return "";
  if (typeof val === "string") return val;
  if (Array.isArray(val)) {
    return val.map(v => (typeof v === "string" ? v : (v && (v.text||v.value||v.answer||v.content)) ?? JSON.stringify(v))).filter(Boolean).join("\n");
  }
  return (val && (val.text || val.value || val.answer || val.content)) ?? JSON.stringify(val);
}

let lang = (langSelect && langSelect.value) || "SE";
function setLanguage(newLang, { announce = true } = {}) {
  lang = newLang;
  if (langSelect) langSelect.value = newLang;
  if (input) input.placeholder = (uiCopy[newLang] || uiCopy.SE).input;
  const privacyNotice = document.getElementById('chat-privacy-notice');
  if (privacyNotice) privacyNotice.textContent = privacyCopy[newLang] || privacyCopy.SE;
  const privacyLink = document.getElementById('chat-privacy-link');
  if (privacyLink) privacyLink.textContent = privacyLinkCopy[newLang] || privacyLinkCopy.SE;
  document.querySelectorAll('[data-action]').forEach(button => { button.textContent = (uiCopy[newLang] || uiCopy.SE)[button.dataset.action]; });
  if (enterHelp) enterHelp.textContent = (uiCopy[newLang] || uiCopy.SE).help;
  flagButtons.forEach(btn => btn.setAttribute("aria-pressed", btn.dataset.lang === newLang ? "true" : "false"));
  if (announce) showBanner(langBanner, `🌐 Språk ändrat till ${newLang}`);
}
flagButtons.forEach(btn => btn.addEventListener("click", () => {
  setLanguage(btn.dataset.lang);
  if (rec) { try { rec.abort(); } catch {} setupRecognition(); }
}));
langSelect?.addEventListener("change", () => {
  setLanguage(langSelect.value);
  if (rec) { try { rec.abort(); } catch {} setupRecognition(); }
});

function addMessage(text, sender, source = null, canRefine = false, citations = []) {
  if (!messagesDiv) return;
  const followLatest = isNearBottom();
  const div = document.createElement("div");
  div.classList.add("message", sender);

  const bubble = document.createElement("div");
  bubble.className = "bubble";

  const content = document.createElement("div");
  content.className = "content";
  content.innerHTML = renderMarkdown(toDisplay(text));
  bubble.appendChild(content);

  const meta = document.createElement("div");
  meta.className = "info";
  if (source) {
    const badge = document.createElement("small");
    badge.className = "meta";
    badge.textContent = source === "AI" ? "🤖 AI" : (source === "FAQ" || source.startsWith?.("FAQ")) ? "✅ FAQ" : `Källa: ${source}`;
    meta.appendChild(badge);
  }

  if (sender !== "user") {
    const bar = document.createElement("div");
    bar.className = "actions";
    const retry = document.createElement("button");
    retry.className = "btn"; retry.dataset.action = 'retry'; retry.textContent = (uiCopy[lang] || uiCopy.SE).retry;
    retry.addEventListener("click", () => resendLastUser());
    const improve = document.createElement("button");
    improve.className = "btn"; improve.dataset.action = 'refine'; improve.textContent = (uiCopy[lang] || uiCopy.SE).refine;
    const originalQuestion = lastUserText;
    const answerConversation = [...conversation, { role: 'assistant', content: toDisplay(text).slice(0, 1000) }].slice(-6);
    improve.addEventListener("click", () => { if (originalQuestion) sendCore(originalQuestion, lang, { refine: true, priorConversation: lastUserText === originalQuestion ? conversation : answerConversation }); });
    bar.append(retry);
    if (canRefine) bar.append(improve);
    meta.appendChild(bar);
  }

  for (const citation of Array.isArray(citations) ? citations.slice(0, 3) : []) {
    try {
      const url = new URL(citation.url);
      if (url.protocol !== 'https:' || !['klinkerdack.se','www.klinkerdack.se'].includes(url.hostname) || url.port || url.username || url.password || url.search) continue;
      const link = document.createElement('a');
      link.href = url.href; link.target = '_blank'; link.rel = 'noopener noreferrer'; link.referrerPolicy = 'no-referrer';
      link.textContent = ({SE:'Källa: ',DA:'Kilde: ',DE:'Quelle: ',EN:'Source: '}[lang] || 'Source: ') + (citation.title || url.hostname);
      const row = document.createElement('p'); row.append(link); bubble.append(row);
    } catch { /* Invalid citations do not become links. */ }
  }
  div.append(bubble, meta);
  messagesDiv.appendChild(div);

  enhanceCodeBlocks(div);
  maybeAutoScroll(followLatest);
  if (sender !== "user") lastBotAnswer = toDisplay(text);
}

let sending = false;
let lastUserText = "";
let lastBotAnswer = "";
let conversation = [];

function isNearBottom() {
  if (!messageScroller) return true;
  const threshold = 80;
  return (messageScroller.scrollHeight - messageScroller.scrollTop - messageScroller.clientHeight) < threshold;
}
function maybeAutoScroll(force = false) {
  if (force || isNearBottom()) {
    messageScroller.scrollTop = messageScroller.scrollHeight;
    if (jumpBtn) jumpBtn.style.display = "none";
  } else {
    if (jumpBtn) jumpBtn.style.display = "block";
  }
}
messageScroller?.addEventListener("scroll", () => { if (jumpBtn && isNearBottom()) jumpBtn.style.display = "none"; });
jumpBtn?.addEventListener("click", () => { messageScroller.scrollTop = messageScroller.scrollHeight; jumpBtn.style.display = "none"; });

let audioCtx = null, keyTimer = null;
// Preferences last only for this page session; embedded chat needs no browser storage.
let muted = false;
function updateSoundUI(){
  if (!soundBtn) return;
  soundBtn.textContent = muted ? "🔈" : "🔊";
  soundBtn.setAttribute("aria-pressed", String(!muted));
  soundBtn.title = muted ? "Ljud av" : "Ljud på";
}
updateSoundUI();
soundBtn?.addEventListener("click", () => {
  muted = !muted; updateSoundUI(); if (muted) stopTypingSound();
});
function startTypingSound() {
  if (muted) return;
  try { if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch { audioCtx = null; }
  if (!audioCtx) return;
  stopTypingSound();
  keyTimer = setInterval(() => {
    const o = audioCtx.createOscillator(); const g = audioCtx.createGain();
    o.type = "square"; o.frequency.value = 260 + Math.random() * 140;
    g.gain.value = 0.00015 + Math.random() * 0.0006;
    o.connect(g); g.connect(audioCtx.destination); o.start();
    setTimeout(() => o.stop(), 15 + Math.random() * 25);
  }, 95);
  if (thinkingSr) thinkingSr.textContent = "Skriver…";
}
function stopTypingSound() { if (keyTimer) clearInterval(keyTimer); keyTimer = null; if (thinkingSr) thinkingSr.textContent = ""; }

let rec = null;
const canVoice = "webkitSpeechRecognition" in window || "SpeechRecognition" in window;
function setupRecognition() {
  if (!canVoice) return;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  rec = new SR();
  const map = { se: "sv-SE", da: "da-DK", de: "de-DE", en: "en-GB" };
  const k = (lang || "SE").toLowerCase();
  rec.lang = map[k] || "sv-SE";
  rec.interimResults = true; rec.continuous = false;
  rec.onresult = (e) => { let final = ""; for (const r of e.results) final += r[0].transcript; if (input) input.value = final.trim(); };
  rec.onerror = () => { if (voiceBtn) voiceBtn.disabled = true; };
  rec.onend = () => { voiceBtn?.classList.remove("recording"); };
}
if (canVoice) setupRecognition(); else if (voiceBtn) voiceBtn.disabled = true;
voiceBtn?.addEventListener("click", () => { if (!rec) return; try { rec.start(); voiceBtn.classList.add("recording"); } catch {} });

copyBtn?.addEventListener("click", async () => {
  if (!lastBotAnswer) return;
  try { await navigator.clipboard.writeText(lastBotAnswer); showBanner(saveBanner, "📋 Svar kopierat"); }
  catch { showBanner(saveBanner, "⚠️ Kunde inte kopiera"); }
});

function resendLastUser(){ if (!lastUserText) return; sendCore(lastUserText, lang); }
function improveWithAI(faqText){
  if (lastUserText) sendCore(lastUserText, lang, { refine: true });
}

// Generic auto-language banner for all languages
function maybeAnnounceAutoLanguageSwitch(detectedCode){
  const code = (detectedCode||"").toUpperCase();
  const flagMap = { SE:"🇸🇪", EN:"🇬🇧", DA:"🇩🇰", DE:"🇩🇪" };
  const nameMap = { SE:"svenska", EN:"engelska", DA:"danska", DE:"tyska" };
  const flag = flagMap[code] || "";
  const name = nameMap[code] || code;
  // Always same pattern:
  // "OBS! ⚠️ Din fråga verkar vara på {name} – vi bytte språk till {flag} {code}."
  showBanner(langBanner, `OBS! ⚠️ Din fråga verkar vara på ${name} – vi bytte språk till ${flag} ${code}.`, 5000);
}

async function sendCore(text, language, { refine = false, priorConversation = conversation } = {}){
  if (sending) return;
  sending = true;
  try {
    const requestConversation = priorConversation.slice(-6);
    conversation = requestConversation;
    addMessage(text, "user"); lastUserText = text;
    conversation = [...requestConversation, { role: 'user', content: text.slice(0, 1000) }].slice(-6);
    if (input) input.value = "";
    showLoader(); startTypingSound();

    const resp = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, lang: language, refine, conversation: requestConversation }),
      signal: AbortSignal.timeout(35000),
    });

    const ct = (resp.headers.get("content-type") || "").toLowerCase();
    if (resp.status === 429) {
      const throttled = { SE: 'Du har skickat många frågor. Vänta en minut och försök igen.', DA: 'Du har sendt mange spørgsmål. Vent et minut og prøv igen.', DE: 'Sie haben viele Fragen gesendet. Warten Sie eine Minute und versuchen Sie es erneut.', EN: 'You have sent many questions. Wait a minute and try again.' };
      addMessage(throttled[language] || throttled.SE, 'bot', 'RATE-LIMIT');
      return;
    }
    if (!resp.ok && !ct.includes('application/json')) throw new Error(`Chat HTTP ${resp.status}`);

    if (resp.ok && resp.body && (ct.includes("text/event-stream") || ct.includes("text/plain"))) {
      const live = document.createElement("div");
      live.className = "message ai";
      const bubble = document.createElement("div"); bubble.className = "bubble";
      const content = document.createElement("div"); content.className = "content"; bubble.appendChild(content);
      const meta = document.createElement("div"); meta.className = "info";
      const badge = document.createElement("small"); badge.className = "meta"; badge.textContent = "🤖 AI";
      meta.appendChild(badge);
      live.append(bubble, meta);
      messagesDiv.appendChild(live);
      maybeAutoScroll();

      const reader = resp.body.getReader(); const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        content.innerHTML = renderMarkdown(acc); enhanceCodeBlocks(live); maybeAutoScroll();
      }
      lastBotAnswer = acc;
      conversation = [...conversation, { role: 'assistant', content: acc.slice(0, 1000) }].slice(-6);
    } else {
      const data = ct.includes("application/json") ? await resp.json() : { reply: await resp.text(), source: "AI" };

      const detected = (data.detectedLang || data.lang || "").toString().toUpperCase();
      if (["SE","EN","DA","DE"].includes(detected) && detected !== lang) {
        setLanguage(detected, { announce: false });
        maybeAnnounceAutoLanguageSwitch(detected);
      }

      const srcRaw = (data.source || data.via || "").toString();
      const src = srcRaw.toUpperCase();
      const replyText = toDisplay(data.reply ?? "");

      if (detected === "FILTER" || src === "FILTER") {
        showBanner(faqBanner, "⚠️ Din fråga verkar inte relatera till våra produkter");
        addMessage(replyText || "⚠️ Din fråga verkar inte relatera till våra produkter.", "bot", "Filter");
      } else if (src === "AI") {
        addMessage(replyText || "Inget svar.", "ai", "AI", data.canRefine === true, data.citations);
      } else if (src.startsWith("FAQ")) {
        addMessage(replyText || "Inget svar.", "faq", "FAQ", data.canRefine === true, data.citations);
      } else {
        addMessage(replyText || "Inget svar.", "bot", src || "BOT", false, data.citations);
      }
      if (src === 'AI' || src === 'WEBSITE' || src.startsWith('FAQ')) conversation = [...conversation, { role: 'assistant', content: replyText.slice(0, 1000) }].slice(-6);
    }
  } catch (err) {
    console.error("❌ Chat error:", err);
    addMessage("⚠️ Ett fel inträffade.", "bot");
    if (!navigator.onLine) showBanner(statusBanner, "⚠️ Du är offline. Svar kan inte hämtas nu.", 4000);
  } finally {
    hideLoader(); stopTypingSound(); sending = false;
  }
}

async function sendMessage(){ const text = input?.value?.trim(); if (!text) return; await sendCore(text, lang); }

sendBtn?.addEventListener("click", sendMessage);
input?.addEventListener("keydown", (e) => {
  const enterSends = !enterToggle || enterToggle.checked;
  if (e.key === "Enter" && !e.shiftKey) { if (enterSends) { e.preventDefault(); sendBtn?.click(); } }
});
enterToggle?.addEventListener("change", updateEnterHelp);
updateEnterHelp();

window.addEventListener("offline", () => showBanner(statusBanner, "⚠️ Du är offline.", 3000));
window.addEventListener("online",  () => showBanner(statusBanner, "✅ Tillbaka online.", 2000));

newChatBtn?.addEventListener("click", () => {
  if (!confirm("Starta en ny konversation? Befintliga meddelanden rensas.")) return;
  messagesDiv.innerHTML = ""; lastUserText = ""; lastBotAnswer = ""; conversation = [];
  showBanner(statusBanner, "🆕 Ny konversation startad.", 2000); input?.focus();
});


// === List-mode (Q→A stacked on left) ===
function applyListMode(on){
  document.body.classList.toggle('list-mode', !!on);
  if(listTgl) listTgl.checked = !!on;
}
function initListMode(){
  const on = false;
  applyListMode(on);
}
initListMode();

function bindListToggle(){
  if(!listTgl) return;
  if(listTgl._bound) return;
  const onChange = (e)=> applyListMode(!!e.target.checked);
  listTgl.addEventListener('change', onChange);
  listTgl.addEventListener('input', onChange);
  listTgl._bound = true;
}
bindListToggle();
try{ new MutationObserver(()=> bindListToggle()).observe(document.documentElement,{childList:true,subtree:true}); }catch{}
const contactPanel = document.getElementById('contact-options');
let contactTimer, contactGeneration = 0;
async function updateContacts() {
  if (!contactPanel) return;
  clearTimeout(contactTimer);
  const generation = ++contactGeneration;
  // Clear time-limited actions before waiting for a fresh response.
  contactPanel.querySelectorAll('[data-support-action]').forEach(anchor => anchor.remove());
  let refreshMs = 60000;
  try {
    const response = await fetch('/api/contact?lang=' + encodeURIComponent(lang), { signal: AbortSignal.timeout(10000) });
    if (!response.ok) throw new Error('Contact unavailable');
    const data = await response.json();
    if (generation !== contactGeneration) return;
    const deadline = data.validUntil ? Date.parse(data.validUntil) : null;
    refreshMs = data.refreshAfterMs === 900000 ? 900000 : 60000;
    if (Number.isFinite(deadline)) refreshMs = Math.max(1000, Math.min(refreshMs, deadline - Date.now()));
    contactPanel.replaceChildren();
    const status = document.createElement('p'); status.textContent = data.message; contactPanel.append(status);
    if (data.supportHoursNote) { const note = document.createElement('p'); note.textContent = data.supportHoursNote; contactPanel.append(note); }
    if (data.staffMessage) { const note = document.createElement('p'); note.textContent = data.staffMessage; contactPanel.append(note); }
    for (const link of data.links || []) {
      if (!/^(mailto:|tel:|https:\/\/)/.test(link.href)) continue;
      if ((link.type === 'phone' || link.type === 'chat') && deadline !== null && (!Number.isFinite(deadline) || deadline <= Date.now())) continue;
      const anchor = document.createElement('a'); anchor.className = 'btn'; anchor.textContent = link.label; anchor.href = link.href;
      if (link.type === 'phone' || link.type === 'chat') {
        anchor.dataset.supportAction = 'true';
        anchor.addEventListener('click', event => { if (deadline !== null && Date.now() >= deadline) { event.preventDefault(); updateContacts(); } });
      }
      if (link.type === 'chat') { anchor.target = '_blank'; anchor.rel = 'noopener noreferrer'; }
      contactPanel.append(anchor);
    }
    if (data.googleMapsUrl) { const anchor = document.createElement('a'); anchor.href = data.googleMapsUrl; anchor.textContent = 'Google Maps'; anchor.target = '_blank'; anchor.rel = 'noopener noreferrer'; contactPanel.append(anchor); }
    if (data.supportSource === 'google-places' && data.supportOpenNow !== null) {
      const attribution = document.createElement('p'); attribution.textContent = 'Google Maps'; attribution.setAttribute('translate', 'no');
      attribution.style.cssText = 'font-family:Roboto,sans-serif;font-style:normal;font-weight:400;font-size:14px;letter-spacing:normal;white-space:nowrap;color:#5e5e5e'; contactPanel.append(attribution);
      for (const provider of data.attributions || []) {
        if (!/^https:\/\//.test(provider.href)) continue;
        const anchor = document.createElement('a'); anchor.href = provider.href; anchor.textContent = provider.provider; anchor.target = '_blank'; anchor.rel = 'noopener noreferrer'; contactPanel.append(anchor);
      }
    }
    if (data.responseNote) { const note = document.createElement('p'); note.textContent = data.responseNote; contactPanel.append(note); }
  } catch {
    if (generation !== contactGeneration) return;
    contactPanel.textContent = 'Kontaktinformationen kunde inte hämtas. Försök igen om en stund.';
  }
  if (generation === contactGeneration) contactTimer = setTimeout(updateContacts, refreshMs);
}
langSelect?.addEventListener('change', updateContacts);
updateContacts();
