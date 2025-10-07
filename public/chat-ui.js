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

// === API Base ===
const API_BASE = window.location.origin;

// === State ===
let lang = "SE"; 
let lastDetectedLang = null;
let lastSave = null;

function showBanner(element, text, timeout = 3000) {
  if (!element) return;
  element.textContent = text;
  element.style.display = "block";
  setTimeout(() => (element.style.display = "none"), timeout);
}

function showLoader() { loader?.classList.remove("hidden"); }
function hideLoader() { loader?.classList.add("hidden"); }

function updateEnterHelp() {
  if (!enterHelp) return;
  const enterSends = !enterToggle || enterToggle.checked;
  enterHelp.innerHTML = enterSends
    ? 'Tips: Du kan skicka meddelanden med <strong>Enter</strong> eller ➤-knappen.'
    : 'Tips: Använd <strong>Shift+Enter</strong> för radbrytning, och ➤ för att skicka.';
}

// === Add Message ===
function addMessage(text, sender, source = null) {
  if (!messagesDiv) return;

  const div = document.createElement("div");
  div.classList.add("message", sender);

  const p = document.createElement("p");
  p.textContent = text;
  div.appendChild(p);

  if (source) {
    const small = document.createElement("small");
    small.className = "meta";
    small.textContent = `✔️ Källa: ${source}`;
    div.appendChild(small);
  }

  if (sender === "faq" || sender === "ai" || sender === "bot") {
    const fb = document.createElement("div");
    fb.className = "feedback-bar";

    const bFAQ = document.createElement("button");
    bFAQ.className = "btn success";
    bFAQ.textContent = "✅ FAQ";
    bFAQ.addEventListener("click", () => showBanner(saveBanner, "Markerat som FAQ"));

    const bAI = document.createElement("button");
    bAI.className = "btn";
    bAI.textContent = "🤖 AI";

    const bFZ = document.createElement("button");
    bFZ.className = "btn";
    bFZ.textContent = "~ FUZZY";

    const editBtn = document.createElement("button");
    editBtn.className = "inline-edit";
    editBtn.textContent = "✎";
    editBtn.addEventListener("click", () => startEdit(div, p, text));

    const infoWrap = document.createElement("span");
    infoWrap.className = "tooltip btn";
    infoWrap.textContent = "ℹ️";
    const tip = document.createElement("span");
    tip.className = "tooltiptext";
    tip.textContent = source ? `Källa: ${source}` : "Källa: AI";
    infoWrap.appendChild(tip);

    fb.appendChild(bFAQ);
    fb.appendChild(bAI);
    fb.appendChild(bFZ);
    fb.appendChild(editBtn);
    fb.appendChild(infoWrap);
    div.appendChild(fb);
  }

  messagesDiv.appendChild(div);
  messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// === Inline Edit ===
function startEdit(div, p, oldText) {
  const textarea = document.createElement("textarea");
  textarea.value = oldText;

  textarea.style.resize = "none";
  textarea.style.overflow = "hidden";
  textarea.addEventListener("input", () => {
    textarea.style.height = "auto";
    textarea.style.height = textarea.scrollHeight + "px";
  });
  textarea.dispatchEvent(new Event("input"));

  const save = document.createElement("button");
  save.textContent = "Spara";
  save.className = "btn success";

  const cancel = document.createElement("button");
  cancel.textContent = "Avbryt";
  cancel.className = "btn";

  p.replaceWith(textarea);
  const actions = document.createElement("div");
  actions.appendChild(save);
  actions.appendChild(cancel);
  div.appendChild(actions);

  save.addEventListener("click", async () => {
    const newText = textarea.value.trim();
    const newP = document.createElement("p");
    newP.textContent = newText;
    textarea.replaceWith(newP);
    actions.remove();

    const saved = document.createElement("span");
    saved.textContent = "✔️ Sparat";
    saved.className = "inline-saved";
    newP.after(saved);

    lastSave = { element: newP, previous: oldText, current: newText };

    try {
      await fetch(`${API_BASE}/api/save-faq-reply`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: oldText, reply: newText, lang }),
      });
      // 👇 Skicka uppåt till embed.js
      window.parent.postMessage(
        { type: "save-faq", payload: { question: oldText, reply: newText, lang } },
        "*"
      );
    } catch (err) {
      console.error("❌ Save failed:", err);
    }

    if (undoBanner) undoBanner.style.display = "flex";
  });

  cancel.addEventListener("click", () => {
    textarea.replaceWith(p);
    actions.remove();
  });
}

// === Undo ===
undoBtn?.addEventListener("click", async () => {
  if (!lastSave) return;
  try {
    const p = lastSave.element;
    p.textContent = lastSave.previous;
   await fetch("/api/save-faq-reply", {
      method: "POST",
     headers: { "Content-Type": "application/json" },
     body: JSON.stringify({ question: p.textContent, reply: lastSave.previous, lang }),
    });
    await fetch(`${window.location.origin}/api/save-faq-reply`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
     body: JSON.stringify({
      question: p.textContent,
       reply: lastSave.previous,
       lang
     })
    });
  } catch (e) {
    console.warn("Undo save failed:", e);
  } finally {
    if (undoBanner) undoBanner.style.display = "none";
    lastSave = null;
  }
});


async function sendMessage(message, language) {
  addMessage(message, "user");
  showLoader();

  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: message, lang: language, mode: "STRICT" }),
    });

    // Säker JSON-parsning
    const ct = (res.headers.get("content-type") || "").toLowerCase();
    let payload;
    if (ct.includes("application/json")) {
      payload = await res.json();
    } else {
      const text = await res.text();
      console.error("❌ Non-JSON response från /api/chat:", { status: res.status, text });
      throw new Error(`Non-JSON response (status ${res.status})`);
    }

    if (!res.ok) {
      throw new Error(payload?.error || `HTTP ${res.status}`);
    }

    const data = payload || {};
    const src = data.source || "";

    if (src.startsWith("FAQ")) {
      addMessage(data.reply ?? "Inget svar.", "faq", src);
    } else if (src === "FILTER") {
      addMessage(data.reply ?? "⚠️ Din fråga verkar inte relatera till våra produkter.", "bot", "Filter");
      showBanner(faqBanner, "⚠️ Din fråga verkar inte relatera till våra produkter");
    } else if (src === "AI") {
      addMessage(data.reply ?? "Inget svar.", "ai", "AI");
    } else {
      addMessage(data.reply ?? "Inget svar.", "bot");
    }
  } catch (err) {
    console.error("❌ Chat error:", err);
    addMessage("⚠️ Ett fel inträffade.", "bot");
  } finally {
    hideLoader();
  }
}


// === Event listeners ===
sendBtn?.addEventListener("click", async () => {
  const msg = input?.value.trim();
  if (!msg) return;

  await sendMessage(msg, lastDetectedLang || lang);

  if (input) input.value = "";
});

input?.addEventListener("keydown", (e) => {
  const enterSends = !enterToggle || enterToggle.checked;
  if (e.key === "Enter" && !e.shiftKey) {
    if (enterSends) {
      e.preventDefault();
      sendBtn?.click();
    }
  }
});

langSelect?.addEventListener("change", () => {
  lang = langSelect.value;
  lastDetectedLang = null;
  showBanner(faqBanner, `🌐 Språk ändrat manuellt till ${lang}`);
});

enterToggle?.addEventListener("change", updateEnterHelp);
updateEnterHelp();
