// client/chat-ui.js — UPDATED: voice input, copy button, thinking dots+sound, badges
// === DOM refs === 
const messagesDiv = document.getElementById("messages");
const input = document.getElementById("user-input") || document.getElementById("userInput");
const sendBtn = document.getElementById("send-btn") || document.getElementById("sendButton");
const langSelect = document.getElementById("langSelect");

const langBanner = document.getElementById("langBanner");
const faqBanner = document.getElementById("faqBanner");
const saveBanner = document.getElementById("saveBanner");
const loader = document.getElementById("loader");
const thinkingSr = document.getElementById("thinkingSr"); // UPDATED: aria-live 'Skriver…'
const undoBanner = document.getElementById("undoBanner");
const undoBtn = document.getElementById("undoBtn");

const enterToggle = document.getElementById("enter-toggle");
const enterHelp = document.getElementById("enter-help");

// UPDATED: optional refs (present in patched chat.html)
const flagButtons = Array.from(document.querySelectorAll(".lang-switch .flag"));
const voiceBtn = document.getElementById("voice-btn");
const copyBtn  = document.getElementById("copy-btn");

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

// --- Normalize any value to displayable text (defensive against objects/arrays) ---
function toDisplay(val) {
  if (val == null) return "";
  if (typeof val === "string") return val;
  if (Array.isArray(val)) {
    return val
      .map((v) => (typeof v === "string"
        ? v
        : (v && (v.text || v.value || v.answer || v.content)) ?? JSON.stringify(v)))
      .filter(Boolean)
      .join("\n");
  }
  return (val && (val.text || val.value || val.answer || val.content)) ?? JSON.stringify(val);
}

// === Language (optional, non-breaking) ===
let lang = (langSelect && langSelect.value) || "SE"; // source of truth from select
function setLanguage(newLang, { announce = true } = {}) {
  lang = newLang;
  // sync select
  if (langSelect) langSelect.value = newLang;
  // toggle aria-pressed on flags if present
  flagButtons.forEach(btn => {
    const active = btn.dataset.lang === newLang;
    btn.setAttribute("aria-pressed", active ? "true" : "false");
  });
  if (announce) showBanner(langBanner, `🌐 Språk ändrat till ${newLang}`);
}
flagButtons.forEach(btn => btn.addEventListener("click", () => {
  setLanguage(btn.dataset.lang);
  // also refresh voice recognition language if active
  if (rec) { try { rec.abort(); } catch {} setupRecognition(); }
}));
langSelect?.addEventListener("change", () => {
  setLanguage(langSelect.value);
  if (rec) { try { rec.abort(); } catch {} setupRecognition(); }
});

// === Add Message ===
function addMessage(text, sender, source = null) {
  if (!messagesDiv) return;

  const div = document.createElement("div");
  div.classList.add("message", sender);

  const p = document.createElement("p");
  p.textContent = toDisplay(text);
  div.appendChild(p);

  // UPDATED: meta/badge line
  const infoWrap = document.createElement("div");
  infoWrap.className = "info";
  if (source) {
    const badge = document.createElement("small");
    badge.className = "meta";
    badge.textContent = source === "AI" ? "🤖 AI" : source === "FAQ" || source.startsWith?.("FAQ") ? "✅ FAQ" : `Källa: ${source}`;
    infoWrap.appendChild(badge);
  }
  div.appendChild(infoWrap);

  messagesDiv.appendChild(div);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;

  // UPDATED: remember last bot answer for copy
  if (sender !== "user") {
    lastBotAnswer = toDisplay(text);
  }
}

let sending = false; // 🔒 prevent double send
let lastBotAnswer = ""; // UPDATED: for copy button

// === Typing indicator sound (WebAudio) ===
let audioCtx = null;
let keyTimer = null;
function startTypingSound() {
  try {
    if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  } catch { audioCtx = null; }
  if (!audioCtx) return;
  stopTypingSound();
  keyTimer = setInterval(() => {
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = "square";
    o.frequency.value = 260 + Math.random() * 140;
    g.gain.value = 0.00015 + Math.random() * 0.0006; // very low
    o.connect(g); g.connect(audioCtx.destination);
    o.start();
    setTimeout(() => o.stop(), 15 + Math.random() * 25);
  }, 95);
  if (thinkingSr) thinkingSr.textContent = "Skriver…";
}
function stopTypingSound() {
  if (keyTimer) clearInterval(keyTimer);
  keyTimer = null;
  if (thinkingSr) thinkingSr.textContent = "";
}

// === Voice input (Web Speech API) ===
let rec = null;
const canVoice = "webkitSpeechRecognition" in window || "SpeechRecognition" in window;
function setupRecognition() {
  if (!canVoice) return;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  rec = new SR();
  const map = { se: "sv-SE", da: "da-DK", de: "de-DE", en: "en-GB" };
  const k = (lang || "SE").toLowerCase();
  rec.lang = map[k] || "sv-SE";
  rec.interimResults = true;
  rec.continuous = false;
  rec.onresult = (e) => {
    let final = "";
    for (const r of e.results) final += r[0].transcript;
    if (input) input.value = final.trim();
  };
  rec.onerror = () => { if (voiceBtn) voiceBtn.disabled = true; };
  rec.onend = () => { voiceBtn?.classList.remove("recording"); };
}
if (canVoice) setupRecognition(); else if (voiceBtn) voiceBtn.disabled = true;
voiceBtn?.addEventListener("click", () => {
  if (!rec) return;
  try { rec.start(); voiceBtn.classList.add("recording"); } catch {}
});

// === Copy latest bot answer ===
copyBtn?.addEventListener("click", async () => {
  if (!lastBotAnswer) return;
  try {
    await navigator.clipboard.writeText(lastBotAnswer);
    showBanner(saveBanner, "📋 Svar kopierat");
  } catch {
    showBanner(saveBanner, "⚠️ Kunde inte kopiera");
  }
});

async function sendMessage() {
  if (sending) return;
  const text = input?.value?.trim();
  if (!text) return;
  sending = true;
  try {
    addMessage(text, "user");
    input.value = "";
    showLoader();
    startTypingSound(); // UPDATED: begin thinking

    const resp = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, lang }),
    });
    // Defensive: some servers may return text/plain on errors
    const ct = (resp.headers.get("content-type") || "").toLowerCase();
    const data = ct.includes("application/json") ? await resp.json() : { reply: await resp.text(), source: "AI" };
    console.debug("[/api/chat] response:", data);

    const srcRaw = (data.source || data.via || "").toString();
    const src = srcRaw.toUpperCase();
    const replyText = toDisplay(data.reply ?? "");

    if (data.lang === "FILTER" || src === "FILTER") {
      showBanner(faqBanner, "⚠️ Din fråga verkar inte relatera till våra produkter");
      addMessage(replyText || "⚠️ Din fråga verkar inte relatera till våra produkter.", "bot", "Filter");
    } else if (src === "AI") {
      addMessage(replyText || "Inget svar.", "ai", "AI");
    } else if (src.startsWith("FAQ")) {
      addMessage(replyText || "Inget svar.", "faq", "FAQ");
    } else {
      addMessage(replyText || "Inget svar.", "bot", src || "BOT");
    }
  } catch (err) {
    console.error("❌ Chat error:", err);
    addMessage("⚠️ Ett fel inträffade.", "bot");
  } finally {
    hideLoader();
    stopTypingSound(); // UPDATED: end thinking
    sending = false;
  }
}

// === Event listeners ===
sendBtn?.addEventListener("click", sendMessage);
input?.addEventListener("keydown", (e) => {
  const enterSends = !enterToggle || enterToggle.checked;
  if (e.key === "Enter" && !e.shiftKey) {
    if (enterSends) {
      e.preventDefault();
      sendBtn?.click();
    }
  }
});
enterToggle?.addEventListener("change", updateEnterHelp);
updateEnterHelp();
