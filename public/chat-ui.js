// client/chat-ui.js — UPDATED: generic auto-language banner for all languages
const messagesDiv = document.getElementById("messages");
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

const flagButtons = Array.from(document.querySelectorAll(".lang-switch .flag"));
const voiceBtn = document.getElementById("voice-btn");
const copyBtn  = document.getElementById("copy-btn");
const soundBtn = document.getElementById("sound-btn");

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

function addMessage(text, sender, source = null) {
  if (!messagesDiv) return;
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
    retry.className = "btn"; retry.textContent = "↻ Försök igen";
    retry.addEventListener("click", () => resendLastUser());
    const improve = document.createElement("button");
    improve.className = "btn"; improve.textContent = "✨ Förbättra svaret";
    improve.addEventListener("click", () => improveWithAI(text));
    bar.append(retry, improve);
    meta.appendChild(bar);
  }

  div.append(bubble, meta);
  messagesDiv.appendChild(div);

  enhanceCodeBlocks(div);
  maybeAutoScroll();
  if (sender !== "user") lastBotAnswer = toDisplay(text);
}

let sending = false;
let lastUserText = "";
let lastBotAnswer = "";

function isNearBottom() {
  if (!messagesDiv) return true;
  const threshold = 80;
  return (messagesDiv.scrollHeight - messagesDiv.scrollTop - messagesDiv.clientHeight) < threshold;
}
function maybeAutoScroll() {
  if (isNearBottom()) {
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    jumpBtn.style.display = "none";
  } else {
    jumpBtn.style.display = "block";
  }
}
messagesDiv?.addEventListener("scroll", () => { if (isNearBottom()) jumpBtn.style.display = "none"; });
jumpBtn?.addEventListener("click", () => { messagesDiv.scrollTop = messagesDiv.scrollHeight; jumpBtn.style.display = "none"; });

let audioCtx = null, keyTimer = null;
let muted = localStorage.getItem("ui.muted") === "1";
function updateSoundUI(){
  if (!soundBtn) return;
  soundBtn.textContent = muted ? "🔈" : "🔊";
  soundBtn.setAttribute("aria-pressed", String(!muted));
  soundBtn.title = muted ? "Ljud av" : "Ljud på";
}
updateSoundUI();
soundBtn?.addEventListener("click", () => {
  muted = !muted; localStorage.setItem("ui.muted", muted ? "1" : "0"); updateSoundUI(); if (muted) stopTypingSound();
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
  const prompt = `Förbättra svaret enligt nedan. Kontext (FAQ):\n\n${toDisplay(faqText)}\n\nKrav: Var tydlig och handlingsbar.`;
  sendCore(prompt, lang);
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

async function sendCore(text, language){
  if (sending) return;
  sending = true;
  try {
    addMessage(text, "user"); lastUserText = text;
    if (input) input.value = "";
    showLoader(); startTypingSound();

    const resp = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, lang: language }),
    });

    const ct = (resp.headers.get("content-type") || "").toLowerCase();

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
        addMessage(replyText || "Inget svar.", "ai", "AI");
      } else if (src.startsWith("FAQ")) {
        addMessage(replyText || "Inget svar.", "faq", "FAQ");
      } else {
        addMessage(replyText || "Inget svar.", "bot", src || "BOT");
      }
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
  messagesDiv.innerHTML = ""; lastUserText = ""; lastBotAnswer = "";
  showBanner(statusBanner, "🆕 Ny konversation startad.", 2000); input?.focus();
});


// === List-mode (Q→A stacked on left) ===
function applyListMode(on){
  document.body.classList.toggle('list-mode', !!on);
  try{ localStorage.setItem('ui.list', on?'1':'0'); }catch{}
  if(listTgl) listTgl.checked = !!on;
}
function initListMode(){
  let on=false; try{ on = localStorage.getItem('ui.list')==='1'; }catch{}
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
