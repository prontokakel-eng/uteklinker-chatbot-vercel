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
  SE: { contactUnknown: 'Kontaktstatusen kan inte verifieras just nu. Använd e-post eller försök igen om en stund.', contactUnavailable: 'Kontaktinformationen kunde inte hämtas. Försök igen om en stund.', input: 'Skriv ett meddelande...', retry: 'Försök igen', refine: 'Utveckla svaret', help: 'Skicka med Enter eller sändknappen.' },
  EN: { contactUnknown: 'Contact status cannot be verified right now. Use email or try again shortly.', contactUnavailable: 'Contact information could not be loaded. Please try again shortly.', input: 'Type a message...', retry: 'Try again', refine: 'Explain in more detail', help: 'Send with Enter or the send button.' },
  DA: { contactUnknown: 'Kontaktstatus kan ikke bekræftes lige nu. Brug e-mail, eller prøv igen om lidt.', contactUnavailable: 'Kontaktoplysningerne kunne ikke hentes. Prøv igen om lidt.', input: 'Skriv en besked...', retry: 'Prøv igen', refine: 'Uddyb svaret', help: 'Send med Enter eller send-knappen.' },
  DE: { contactUnknown: 'Der Kontaktstatus kann gerade nicht bestätigt werden. Nutzen Sie E-Mail oder versuchen Sie es später erneut.', contactUnavailable: 'Die Kontaktinformationen konnten nicht geladen werden. Bitte versuchen Sie es später erneut.', input: 'Nachricht eingeben...', retry: 'Erneut versuchen', refine: 'Antwort erläutern', help: 'Mit Enter oder der Senden-Taste senden.' },
};
const statusCopy = {
  "SE": {
    "switched": "Språk ändrat till svenska.",
    "autoSwitched": "Din fråga verkar vara på svenska. Språket har ändrats till svenska.",
    "newConfirm": "Starta en ny konversation? Befintliga meddelanden rensas.",
    "newStarted": "Ny konversation startad.",
    "error": "Ett fel inträffade. Försök igen.",
    "offline": "Du är offline. Svar kan inte hämtas nu.",
    "online": "Tillbaka online.",
    "noReply": "Inget svar.",
    "filter": "Din fråga verkar inte relatera till våra produkter.",
    "source": "Källa: ",
    "copy": "Kopiera",
    "copied": "Kopierat ✓",
    "copyFailed": "Kunde inte kopiera.",
    "typing": "Skriver…",
    "soundOff": "Ljud av",
    "soundOn": "Ljud på",
    "lineHelp": "Använd Shift+Enter för radbrytning och sändknappen för att skicka."
  },
  "DA": {
    "switched": "Sproget er ændret til dansk.",
    "autoSwitched": "Dit spørgsmål ser ud til at være på dansk. Sproget er ændret til dansk.",
    "newConfirm": "Start en ny samtale? Eksisterende beskeder slettes.",
    "newStarted": "En ny samtale er startet.",
    "error": "Der opstod en fejl. Prøv igen.",
    "offline": "Du er offline. Svar kan ikke hentes lige nu.",
    "online": "Du er online igen.",
    "noReply": "Intet svar.",
    "filter": "Dit spørgsmål ser ikke ud til at vedrøre vores produkter.",
    "source": "Kilde: ",
    "copy": "Kopiér",
    "copied": "Kopieret ✓",
    "copyFailed": "Kunne ikke kopiere.",
    "typing": "Skriver…",
    "soundOff": "Lyd fra",
    "soundOn": "Lyd til",
    "lineHelp": "Brug Shift+Enter til linjeskift og send-knappen til at sende."
  },
  "DE": {
    "switched": "Die Sprache wurde auf Deutsch umgestellt.",
    "autoSwitched": "Ihre Frage scheint auf Deutsch zu sein. Die Sprache wurde auf Deutsch umgestellt.",
    "newConfirm": "Ein neues Gespräch starten? Vorhandene Nachrichten werden gelöscht.",
    "newStarted": "Ein neues Gespräch wurde gestartet.",
    "error": "Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.",
    "offline": "Sie sind offline. Antworten können gerade nicht geladen werden.",
    "online": "Sie sind wieder online.",
    "noReply": "Keine Antwort.",
    "filter": "Ihre Frage scheint sich nicht auf unsere Produkte zu beziehen.",
    "source": "Quelle: ",
    "copy": "Kopieren",
    "copied": "Kopiert ✓",
    "copyFailed": "Kopieren fehlgeschlagen.",
    "typing": "Schreibt…",
    "soundOff": "Ton aus",
    "soundOn": "Ton an",
    "lineHelp": "Mit Shift+Enter einen Zeilenumbruch einfügen und mit der Senden-Taste senden."
  },
  "EN": {
    "switched": "Language changed to English.",
    "autoSwitched": "Your question appears to be in English. The language has been changed to English.",
    "newConfirm": "Start a new conversation? Existing messages will be cleared.",
    "newStarted": "A new conversation has started.",
    "error": "An error occurred. Please try again.",
    "offline": "You are offline. Answers cannot be loaded right now.",
    "online": "You are back online.",
    "noReply": "No answer.",
    "filter": "Your question does not appear to relate to our products.",
    "source": "Source: ",
    "copy": "Copy",
    "copied": "Copied ✓",
    "copyFailed": "Could not copy.",
    "typing": "Typing…",
    "soundOff": "Sound off",
    "soundOn": "Sound on",
    "lineHelp": "Use Shift+Enter for a new line and the send button to send."
  }
};
function uiText(key) { return (statusCopy[lang] || statusCopy.SE)[key]; }

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
let loaderTimer;
const waitingCopy={
  SE:['Hämtar svar…','Det tar lite längre tid än vanligt…'],
  DA:['Henter svar…','Det tager lidt længere tid end normalt…'],
  DE:['Antwort wird abgerufen…','Es dauert etwas länger als üblich…'],
  EN:['Getting your answer…','This is taking a little longer than usual…'],
};
function hideLoader(){ clearTimeout(loaderTimer);if (loader) loader.classList.add("hidden"); }
function showLoader(){
  clearTimeout(loaderTimer);
  if (!loader) return;
  const status=document.getElementById('waiting-status');
  if(status)status.textContent=(waitingCopy[lang] || waitingCopy.SE)[0];
  loader.classList.remove("hidden");
  loaderTimer=setTimeout(()=>{if(status)status.textContent=(waitingCopy[lang] || waitingCopy.SE)[1];},7000);
}

function updateEnterHelp() {
  if (!enterHelp) return;
  const enterSends = !enterToggle || enterToggle.checked;
  enterHelp.textContent = enterSends ? (uiCopy[lang] || uiCopy.SE).help : uiText('lineHelp');
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
    btn.dataset.ui = 'copy'; btn.textContent = uiText('copy');
    btn.style.float = 'right';
    btn.addEventListener('click', async ()=>{
      try { await navigator.clipboard.writeText(pre.innerText); btn.textContent = uiText('copied'); setTimeout(()=>btn.textContent=uiText('copy'),1200); }
      catch { btn.textContent=uiText('copyFailed'); setTimeout(()=>btn.textContent=uiText('copy'),1200); }
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
  updateEnterHelp();
  document.querySelectorAll('[data-ui]').forEach(node => { node.textContent = uiText(node.dataset.ui); });
  document.querySelectorAll('[data-source]').forEach(node => { node.textContent = uiText('source') + node.dataset.source; });
  updateSoundUI();
  flagButtons.forEach(btn => btn.setAttribute("aria-pressed", btn.dataset.lang === newLang ? "true" : "false"));
  window.dispatchEvent(new CustomEvent('pronto-language-change'));
  updateContacts();
  if (announce) showBanner(langBanner, '🌐 ' + uiText('switched'));
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
  if (source && !['GUIDANCE','PRODUCTS'].includes(source)) {
    const badge = document.createElement("small");
    badge.className = "meta";
    badge.textContent = source === "AI" ? "🤖 AI" : (source === "FAQ" || source.startsWith?.("FAQ")) ? "✅ FAQ" : uiText('source') + source;
    if (source !== 'AI' && !source.startsWith('FAQ')) badge.dataset.source = source;
    meta.appendChild(badge);
  }

  if (sender !== "user" && !['GUIDANCE','PRODUCTS'].includes(source)) {
    const bar = document.createElement("div");
    bar.className = "actions";
    const retry = document.createElement("button");
    retry.className = "btn"; retry.dataset.action = 'retry'; retry.textContent = (uiCopy[lang] || uiCopy.SE).retry;
    retry.addEventListener("click", () => resendLastUser());
    const improve = document.createElement("button");
    improve.className = "btn"; improve.dataset.action = 'refine'; improve.textContent = (uiCopy[lang] || uiCopy.SE).refine;
    const originalQuestion = lastUserText;
    const answerConversation = [...conversation, { role: 'assistant', content: toDisplay(text).slice(0, 2400), source }].slice(-32);
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
      link.textContent = (citation.kind === 'product' ? ({SE:'Visa produkt: ',DA:'Se produkt: ',DE:'Produkt ansehen: ',EN:'View product: '}[lang] || 'View product: ') : ({SE:'Källa: ',DA:'Kilde: ',DE:'Quelle: ',EN:'Source: '}[lang] || 'Source: ')) + (citation.title || url.hostname);
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
// Routing hint only; never a fact, source or approval. Kept in memory only.
let routingContext = null;

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
let muted = true;
function updateSoundUI(){
  if (!soundBtn) return;
  soundBtn.textContent = muted ? "🔈" : "🔊";
  soundBtn.setAttribute("aria-pressed", String(!muted));
  soundBtn.title = uiText(muted ? 'soundOff' : 'soundOn');
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
  try { await navigator.clipboard.writeText(lastBotAnswer); showBanner(saveBanner, '📋 ' + uiText('copied')); }
  catch { showBanner(saveBanner, '⚠️ ' + uiText('copyFailed')); }
});

function resendLastUser(){ if (!lastUserText) return; sendCore(lastUserText, lang); }
function improveWithAI(faqText){
  if (lastUserText) sendCore(lastUserText, lang, { refine: true });
}

// Describe the interface switch in the newly selected language. Existing answers
// are not translated or changed by switching the interface language.
function maybeAnnounceAutoLanguageSwitch(detectedCode){
  const code = (detectedCode || '').toUpperCase();
  showBanner(langBanner, '🌐 ' + (statusCopy[code] || statusCopy.SE).autoSwitched, 5000);
}

async function sendCore(text, language, { refine = false, priorConversation = conversation } = {}){
  if (sending) return;
  sending = true;
  if (sendBtn) sendBtn.disabled = true;
  if (newChatBtn) newChatBtn.disabled = true;
  try {
    const requestConversation = priorConversation.slice(-32);
    const experiment=typeof window!=='undefined' && new URLSearchParams(window.location?.search || '').get('experiment')==='single'?'single':undefined;
    conversation = requestConversation;
    addMessage(text, "user"); lastUserText = text;
    conversation = [...requestConversation, { role: 'user', content: text.slice(0, 2400) }].slice(-32);
    if (input) input.value = "";
    showLoader(); startTypingSound();

    const resp = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, lang: language, refine, conversation: requestConversation, routingContext, experiment }),
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
      routingContext = null;
      lastBotAnswer = acc;
      conversation = [...conversation, { role: 'assistant', content: acc.slice(0, 2400), source: 'AI' }].slice(-32);
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
      // Blocked/failed requests do not erase the last valid conversation topic.
      if (resp.ok && !['FILTER', 'RATE-LIMIT', 'AI_ERROR', 'DATA_ERROR'].includes(src)) {
        routingContext = data.routingContext === 'warranty' ? 'warranty' : null;
      }

      if (detected === "FILTER" || src === "FILTER") {
        showBanner(faqBanner, '⚠️ ' + uiText('filter'));
        addMessage(replyText || ('⚠️ ' + uiText('filter')), "bot", "Filter");
      } else if (src === "AI") {
        addMessage(replyText || uiText('noReply'), "ai", "AI", data.canRefine === true, data.citations);
      } else if (src.startsWith("FAQ")) {
        addMessage(replyText || uiText('noReply'), "faq", "FAQ", data.canRefine === true, data.citations);
      } else {
        addMessage(replyText || uiText('noReply'), "bot", src || "BOT", false, data.citations);
      }
      if (resp.ok && (['AI','WEBSITE','GUIDANCE','PRODUCTS','CONTACT','GREETING'].includes(src) || src.startsWith('FAQ'))) conversation = [...conversation, { role: 'assistant', content: replyText.slice(0, 2400), source: src.startsWith('FAQ') ? 'FAQ' : src }].slice(-32);
    }
  } catch (err) {
    console.error("❌ Chat error:", err);
    addMessage('⚠️ ' + uiText('error'), 'bot');
    if (!navigator.onLine) showBanner(statusBanner, '⚠️ ' + uiText('offline'), 4000);
  } finally {
    hideLoader(); stopTypingSound(); sending = false;
    if (sendBtn) sendBtn.disabled = false;
    if (newChatBtn) newChatBtn.disabled = false;
  }
}

async function sendMessage(){ const text = input?.value?.trim(); if (!text) return; await sendCore(text, lang); }

sendBtn?.addEventListener("click", sendMessage);
input?.addEventListener("keydown", (e) => {
  const enterSends = !enterToggle || enterToggle.checked;
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { if (enterSends) { e.preventDefault(); sendBtn?.click(); } }
});
enterToggle?.addEventListener("change", updateEnterHelp);
updateEnterHelp();

window.addEventListener("offline", () => showBanner(statusBanner, '⚠️ ' + uiText('offline'), 3000));
window.addEventListener("online",  () => showBanner(statusBanner, '✅ ' + uiText('online'), 2000));

newChatBtn?.addEventListener("click", () => {
  if (!confirm(uiText('newConfirm'))) return;
  messagesDiv.innerHTML = ""; lastUserText = ""; lastBotAnswer = ""; conversation = []; routingContext = null;
  showBanner(statusBanner, '🆕 ' + uiText('newStarted'), 2000); input?.focus();
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
    let data = await response.json();
    if (generation !== contactGeneration) return;
    const deadline = data.validUntil ? Date.parse(data.validUntil) : null;
    refreshMs = data.refreshAfterMs === 900000 ? 900000 : 60000;
    const expired = deadline !== null && (!Number.isFinite(deadline) || deadline <= Date.now());
    if (expired) {
      // An old open/available statement is no safer than an expired action.
      data = { ...data, message: (uiCopy[lang] || uiCopy.SE).contactUnknown,
        supportOpenNow: null, supportHoursNote: null, staffMessage: null,
        links: (data.links || []).filter(link => link.type === 'email') };
      refreshMs = 60000;
    } else if (Number.isFinite(deadline)) refreshMs = Math.max(1000, Math.min(refreshMs, deadline - Date.now()));
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
    contactPanel.textContent = (uiCopy[lang] || uiCopy.SE).contactUnavailable;
  }
  if (generation === contactGeneration) contactTimer = setTimeout(updateContacts, refreshMs);
}
updateContacts();
