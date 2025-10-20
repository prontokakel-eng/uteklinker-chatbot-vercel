// === i18n helpers for system messages (MUST be defined BEFORE any usage) ===
window._langName ||= function _langName(code, ui){
  const N = {
    SE: { SE:"Svenska",   EN:"Engelska",  DA:"Danska",   DE:"Tyska"   },
    EN: { SE:"Swedish",   EN:"English",   DA:"Danish",   DE:"German"  },
    DA: { SE:"Svensk",    EN:"Engelsk",   DA:"Dansk",    DE:"Tysk"    },
    DE: { SE:"Schwedisch",EN:"Englisch",  DA:"Dänisch",  DE:"Deutsch" }
  };
  const dict = N[(ui||'SE').toUpperCase()] || N.SE;
  return dict[(code||'SE').toUpperCase()] || code;
};
window._switchText ||= function _switchText(code, ui){
  const L = (ui||'SE').toUpperCase();
  const name = _langName(code, ui);
  if (L === 'EN') return `Switched to ${name}`;
  if (L === 'DA') return `Skiftede til ${name}`;
  if (L === 'DE') return `Zu ${name} gewechselt`;
  return `Bytte till ${name}`; // SE default
};
window._autoDetectBannerText ||= function _autoDetectBannerText(code, ui){
  const flags = { SE:'🇸🇪', EN:'🇬🇧', DA:'🇩🇰', DE:'🇩🇪' };
  const name = _langName(code, ui);
  const flag = flags[(code||'SE').toUpperCase()] || '';
  const L = (ui||'SE').toUpperCase();
  if (L === 'EN') return `Heads up! ⚠️ Your question seems to be in ${name} — we switched to ${flag} ${code}.`;
  if (L === 'DA') return `OBS! ⚠️ Dit spørgsmål ser ud til at være på ${name} — vi skiftede til ${flag} ${code}.`;
  if (L === 'DE') return `Hinweis! ⚠️ Ihre Frage scheint auf ${name} zu sein — wir haben auf ${flag} ${code} umgestellt.`;
  return `OBS! ⚠️ Din fråga verkar vara på ${name} – vi bytte språk till ${flag} ${code}.`; // SE
};

// client/chat-ui.js — RESTORE A–D: Retry/Improve, Status toasts, Jump-to-latest, New conversation
const messagesDiv = document.getElementById("messages");
const input = document.getElementById("user-input") || document.getElementById("userInput");
const sendBtn = document.getElementById("send-btn") || document.getElementById("sendButton");
const langSelect = document.getElementById("langSelect");

const langBanner   = document.getElementById("langBanner");
const faqBanner    = document.getElementById("faqBanner");
const saveBanner   = document.getElementById("saveBanner");
const statusBanner = document.getElementById("statusBanner") || null;
const loader       = document.getElementById("loader");
const thinkingSr   = document.getElementById("thinkingSr") || null;
const undoBanner   = document.getElementById("undoBanner") || null;
const undoBtn      = document.getElementById("undoBtn") || null;

const enterToggle  = document.getElementById("enter-toggle");
const enterHelp    = document.getElementById("enter-help");
const newChatBtn   = document.getElementById("new-chat-btn") || null;
const jumpBtn      = document.getElementById("jump-btn") || null;

const flagButtons = Array.from(document.querySelectorAll(".lang-switch .flag"));
const voiceBtn    = document.getElementById("voice-btn") || null;
const copyBtn     = document.getElementById("copy-btn")  || null;
const soundBtn    = document.getElementById("sound-btn") || null;

function showBanner(el, text, timeout = 3000){ if(!el) return; el.textContent = text; el.style.display="block"; setTimeout(()=>el.style.display="none", timeout); }
function hideLoader(){ if(loader) loader.classList.add("hidden"); }
function showLoader(){ if(loader) loader.classList.remove("hidden"); }

function updateEnterHelp(){
  if(!enterHelp) return;
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
function enhanceCodeBlocks(root){
  root.querySelectorAll('pre').forEach(pre=>{
    if (pre.querySelector('.copy-code')) return;
    const btn = document.createElement('button');
    btn.className='btn copy-code'; btn.type='button'; btn.textContent='Kopiera'; btn.style.float='right';
    btn.addEventListener('click', async ()=>{
      try{ await navigator.clipboard.writeText(pre.innerText); btn.textContent='Kopierat ✓'; setTimeout(()=>btn.textContent='Kopiera',1200); }
      catch{ btn.textContent='Fel'; setTimeout(()=>btn.textContent='Kopiera',1200); }
    });
    pre.prepend(btn);
  });
}

function toDisplay(v){ if(v==null) return ""; if(typeof v==="string") return v;
  if(Array.isArray(v)) return v.map(x=> typeof x==="string"?x : (x&&(x.text||x.value||x.answer||x.content)) ?? JSON.stringify(x)).filter(Boolean).join("\n");
  return (v&&(v.text||v.value||v.answer||v.content)) ?? JSON.stringify(v); }

let lang = (langSelect && langSelect.value) || "SE";
function setLanguage(newLang,{announce=true}={}){
  lang=newLang; if(langSelect) langSelect.value=newLang;
  flagButtons.forEach(b=>b.setAttribute("aria-pressed", b.dataset.lang===newLang?"true":"false"));
  if(announce) showBanner(langBanner,`🌐 Språk ändrat till ${newLang}`);
}
flagButtons.forEach(btn=>btn.addEventListener("click",()=>{ setLanguage(btn.dataset.lang); if(rec){ try{rec.abort();}catch{} setupRecognition(); }}));
langSelect?.addEventListener("change",()=>{ setLanguage(langSelect.value); if(rec){ try{rec.abort();}catch{} setupRecognition(); }});

function addMessage(text,sender,source=null){
  if(!messagesDiv) return;
  const div=document.createElement("div"); div.classList.add("message",sender);
  const bubble=document.createElement("div"); bubble.className="bubble";
  const content=document.createElement("div"); content.className="content"; content.innerHTML=renderMarkdown(toDisplay(text));
  bubble.appendChild(content);

  const meta=document.createElement("div"); meta.className="info";
  if(source){ const badge=document.createElement("small"); badge.className="meta"; badge.textContent = source==="AI"?"🤖 AI": (typeof source==="string" && source.startsWith("FAQ"))?"✅ FAQ":`Källa: ${source}`; meta.appendChild(badge); }

  // A) Retry/Improve action bar
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

  div.append(bubble,meta);
  messagesDiv.appendChild(div);

  enhanceCodeBlocks(div);
  maybeAutoScroll();
  if (sender !== "user") lastBotAnswer = toDisplay(text);
}

// C) Scroll lock + jump-to-latest
function isNearBottom() {
  if (!messagesDiv) return true;
  const threshold = 80;
  return (messagesDiv.scrollHeight - messagesDiv.scrollTop - messagesDiv.clientHeight) < threshold;
}
function maybeAutoScroll() {
  if (!messagesDiv) return;
  if (isNearBottom()) {
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    if (jumpBtn) jumpBtn.style.display = "none";
  } else {
    if (jumpBtn) jumpBtn.style.display = "block";
  }
}
messagesDiv?.addEventListener("scroll", () => { if (isNearBottom() && jumpBtn) jumpBtn.style.display = "none"; });
jumpBtn?.addEventListener("click", () => { if (!messagesDiv) return; messagesDiv.scrollTop = messagesDiv.scrollHeight; if (jumpBtn) jumpBtn.style.display = "none"; });

let sending=false, lastUserText="", lastBotAnswer="";

// Typing-ljud (mute)
let audioCtx=null, keyTimer=null;
let muted = (typeof localStorage!=="undefined") && localStorage.getItem("ui.muted")==="1";
function updateSoundUI(){ if(!soundBtn) return; soundBtn.textContent = muted ? "🔈" : "🔊"; soundBtn.setAttribute("aria-pressed", String(!muted)); }
updateSoundUI();
soundBtn?.addEventListener("click",()=>{ muted=!muted; try{localStorage.setItem("ui.muted", muted?"1":"0");}catch{} updateSoundUI(); if(muted) stopTypingSound(); });
function startTypingSound(){ if(muted) return; try{ if(!audioCtx) audioCtx=new (window.AudioContext||window.webkitAudioContext)(); }catch{audioCtx=null;} if(!audioCtx) return;
  stopTypingSound(); keyTimer=setInterval(()=>{ const o=audioCtx.createOscillator(), g=audioCtx.createGain(); o.type="square"; o.frequency.value=260+Math.random()*140; g.gain.value=0.00015+Math.random()*0.0006;
    o.connect(g); g.connect(audioCtx.destination); o.start(); setTimeout(()=>o.stop(), 15+Math.random()*25); },95);
  if(thinkingSr) thinkingSr.textContent="Skriver…"; }
function stopTypingSound(){ if(keyTimer) clearInterval(keyTimer); keyTimer=null; if(thinkingSr) thinkingSr.textContent=""; }

// Voice (Web Speech)
let rec=null; const canVoice = "webkitSpeechRecognition" in window || "SpeechRecognition" in window;
function setupRecognition(){ if(!canVoice) return; const SR=window.SpeechRecognition||window.webkitSpeechRecognition; rec=new SR();
  const map={se:"sv-SE",da:"da-DK",de:"de-DE",en:"en-GB"}; rec.lang=map[(lang||"SE").toLowerCase()]||"sv-SE"; rec.interimResults=true; rec.continuous=false;
  rec.onresult=e=>{ let s=""; for(const r of e.results) s+=r[0].transcript; if(input) input.value=s.trim(); }; rec.onerror=()=>{ if(voiceBtn) voiceBtn.disabled=true; }; rec.onend=()=>{ voiceBtn?.classList.remove("recording"); }; }
if(canVoice) setupRecognition(); else if(voiceBtn) voiceBtn.disabled=true;
voiceBtn?.addEventListener("click",()=>{ if(!rec) return; try{ rec.start(); voiceBtn.classList.add("recording"); }catch{} });

// Copy senaste svar
copyBtn?.addEventListener("click", async ()=>{ if(!lastBotAnswer) return; try{ await navigator.clipboard.writeText(lastBotAnswer); showBanner(saveBanner,"📋 Svar kopierat"); }catch{ showBanner(saveBanner,"⚠️ Kunde inte kopiera"); }});

// Auto-språkbanner (alla)
function announceAutoLang(detected){
  const code=(detected||"").toUpperCase();
  const flags={SE:"🇸🇪",EN:"🇬🇧",DA:"🇩🇰",DE:"🇩🇪"};
  const names={SE:"svenska",EN:"engelska",DA:"danska",DE:"tyska"};
  if(!flags[code]) return;
  showBanner(langBanner, `OBS! ⚠️ Din fråga verkar vara på ${names[code]} – vi bytte språk till ${flags[code]} ${code}.`, 5000);
}

// Retry/Improve
function resendLastUser(){ if(!lastUserText) return; sendCore(lastUserText, lang); }
function improveWithAI(faqText){ const prompt=`Förbättra svaret enligt nedan. Kontext (FAQ):\n\n${toDisplay(faqText)}\n\nKrav: Var tydlig och handlingsbar.`; sendCore(prompt, lang); }

// Core send
async function sendCore(text, language){
  if(sending) return; sending=true;
  try{
    addMessage(text,"user"); lastUserText=text; if(input) input.value=""; showLoader(); startTypingSound();

    const resp = await fetch("/api/chat",{ method:"POST", headers:{ "Content-Type":"application/json" }, body:JSON.stringify({ text, lang: language }) });
    const ct=(resp.headers.get("content-type")||"").toLowerCase();

    if(resp.ok && resp.body && (ct.includes("text/event-stream") || ct.includes("text/plain"))){
      const live=document.createElement("div"); live.className="message ai";
      const bubble=document.createElement("div"); bubble.className="bubble";
      const content=document.createElement("div"); content.className="content"; bubble.appendChild(content);
      const meta=document.createElement("div"); meta.className="info"; const badge=document.createElement("small"); badge.className="meta"; badge.textContent="🤖 AI"; meta.appendChild(badge);
      live.append(bubble,meta); messagesDiv.appendChild(live); maybeAutoScroll();
      const reader=resp.body.getReader(); const decoder=new TextDecoder(); let acc="";
      while(true){ const {value,done}=await reader.read(); if(done) break; acc+=decoder.decode(value,{stream:true}); content.innerHTML=renderMarkdown(acc); enhanceCodeBlocks(live); maybeAutoScroll(); }
      lastBotAnswer=acc;
    } else {
      const data = ct.includes("application/json") ? await resp.json() : { reply: await resp.text(), source:"AI" };
      const detected=(data.detectedLang || data.lang || "").toString().toUpperCase();
      if(["SE","EN","DA","DE"].includes(detected) && detected!==lang){ setLanguage(detected,{announce:false}); announceAutoLang(detected); }
      const src=(data.source || data.via || "").toString().toUpperCase();
      const replyText = toDisplay(data.reply ?? "");
      if(detected==="FILTER" || src==="FILTER"){ showBanner(faqBanner,"⚠️ Din fråga verkar inte relatera till våra produkter"); addMessage(replyText||"⚠️ Din fråga verkar inte relatera till våra produkter.","bot","Filter"); }
      else if(src==="AI"){ addMessage(replyText||"Inget svar.","ai","AI"); }
      else if(src.startsWith("FAQ")){ addMessage(replyText||"Inget svar.","faq","FAQ"); }
      else { addMessage(replyText||"Inget svar.","bot",src||"BOT"); }
    }
  } catch (err){
    console.error("❌ Chat error:", err);
    addMessage("⚠️ Ett fel inträffade.","bot");
    if(!navigator.onLine) showBanner(statusBanner,"⚠️ Du är offline. Svar kan inte hämtas nu.",4000);
  } finally {
    hideLoader(); stopTypingSound(); sending=false;
  }
}

async function sendMessage(){ const text=input?.value?.trim(); if(!text) return; await sendCore(text, lang); }
sendBtn?.addEventListener("click", sendMessage);
input?.addEventListener("keydown",(e)=>{ const enterSends=!enterToggle || enterToggle.checked; if(e.key==="Enter" && !e.shiftKey){ if(enterSends){ e.preventDefault(); sendBtn?.click(); } }});
enterToggle?.addEventListener("change", updateEnterHelp);
updateEnterHelp();

// Status toasts
window.addEventListener("offline",()=>showBanner(statusBanner,"⚠️ Du är offline.",3000));
window.addEventListener("online", ()=>showBanner(statusBanner,"✅ Tillbaka online.",2000));

// New conversation
newChatBtn?.addEventListener("click", () => {
  if (!confirm("Starta en ny konversation? Befintliga meddelanden rensas.")) return;
  messagesDiv && (messagesDiv.innerHTML = "");
  lastUserText = ""; lastBotAnswer = "";
  showBanner(statusBanner, "🆕 Ny konversation startad.", 2000);
  input?.focus();
});
