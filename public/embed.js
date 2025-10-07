// === API Base ===
const API_BASE = window.location.origin;

window.addEventListener("DOMContentLoaded", () => {
  const iframe = document.createElement("iframe");
  iframe.src = "/chat.html";
  iframe.style.position = "fixed";
  iframe.style.bottom = "20px";
  iframe.style.right = "20px";
  iframe.style.width = "400px";
  iframe.style.height = "600px";
  iframe.style.border = "none";
  iframe.style.borderRadius = "12px";
  iframe.style.boxShadow = "0 4px 12px rgba(0,0,0,0.2)";
  iframe.style.zIndex = "9999";
  iframe.style.display = "none"; // hidden by default

  document.body.appendChild(iframe);

  // === Floating button ===
  const button = document.createElement("button");
  button.textContent = "💬 Chatta med oss";
  button.style.position = "fixed";
  button.style.bottom = "20px";
  button.style.right = "20px";
  button.style.zIndex = "9999";
  button.style.padding = "10px 16px";
  button.style.borderRadius = "50px";
  button.style.border = "none";
  button.style.background = "#0070f3";
  button.style.color = "#fff";
  button.style.fontSize = "16px";
  button.style.cursor = "pointer";
  button.style.boxShadow = "0 2px 6px rgba(0,0,0,0.15)";
  document.body.appendChild(button);

  button.addEventListener("click", () => {
    iframe.style.display = iframe.style.display === "none" ? "block" : "none";
  });

  // === Message passing (för att kunna spara AI/FAQ även inuti iframe) ===
  window.addEventListener("message", async (event) => {
    if (!event.data || typeof event.data !== "object") return;
    const { type, payload } = event.data;

    try {
      if (type === "save-faq") {
        await fetch(`${API_BASE}/api/save-faq-reply`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        console.log("✅ FAQ-svar sparat via embed:", payload);
      }

      if (type === "save-ai") {
        await fetch(`${API_BASE}/api/save-ai-reply`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        console.log("✅ AI-svar sparat via embed:", payload);
      }
    } catch (err) {
      console.error("❌ Embed save error:", err);
    }
  });
});
