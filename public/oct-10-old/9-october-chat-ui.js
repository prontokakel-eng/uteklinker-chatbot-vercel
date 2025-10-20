// client/chat-ui.js — FINAL: no double-send, robust render, source-aware
// === DOM refs === 
const messagesDiv = document.getElementById("messages");
const input = document.getElementById("user-input") || document.getElementById("userInput");
const sendBtn = document.getElementById("send-btn") || document.getElementById("sendButton");
const langSelect = document.getElementById("langSelect");

const langBanner = document.getElementById("langBanner");
const faqBanner = document.getElementById("faqBanner");
const saveBanner = document.getElementById("saveBanner");
const loader = document.getElementById("loader");
const undoBanner = document.getElementById("undoBanner");
const undoBtn = document.getElementById("undoBtn");

const enterToggle = document.getElementById("enter-toggle");
const enterHelp = document.getElementById("enter-help");

function showBanner(element, text, timeout = 3000) {
  if (!element) return;
  element.textContent = text;
  element.style.display = "block";
  setTimeout(() => (element.style.display = "none"), timeout);
}

function hideLoader(){ if (loader) loader.style.display = "none"; }
function showLoader(){ if (loader) loader.style.display = "inline-block"; }

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

// === Add Message ===
function addMessage(text, sender, source = null) {
  if (!messagesDiv) return;

  const div = document.createElement("div");
  div.classList.add("message", sender);

  const p = document.createElement("p");
  p.textContent = toDisplay(text);
  div.appendChild(p);

  const infoWrap = document.createElement("div");
  infoWrap.className = "info";
  const tip = document.createElement("span");
  tip.className = "source";
  tip.textContent = source ? `Källa: ${source}` : "";
  infoWrap.appendChild(tip);
  div.appendChild(infoWrap);

  messagesDiv.appendChild(div);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

let sending = false; // 🔒 prevent double send

async function sendMessage() {
  if (sending) return;
  const text = input?.value?.trim();
  if (!text) return;
  sending = true;
  try {
    addMessage(text, "user");
    input.value = "";
    showLoader();

    const lang = langSelect ? langSelect.value : "SE";

    const resp = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, lang }),
    });
    const data = await resp.json();
    console.debug("[/api/chat] response:", data);

    const srcRaw = (data.source || data.via || "").toString();
    const src = srcRaw.toUpperCase();
    const replyText = toDisplay(data.reply ?? "");

    if (data.lang === "FILTER" || src === "FILTER") {
      showBanner(faqBanner, "⚠️ Din fråga verkar inte relatera till våra produkter");
    } else if (src === "AI") {
      addMessage(replyText || "Inget svar.", "ai", "AI");
    } else {
      addMessage(replyText || "Inget svar.", "bot", src || "FAQ");
    }
  } catch (err) {
    console.error("❌ Chat error:", err);
    addMessage("⚠️ Ett fel inträffade.", "bot");
  } finally {
    hideLoader();
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
