// 🧩 /lib/ip-lang.js
// Lättviktig IP → språkkod fallback (används av gate.js och detect-lang-core.js)

/**
 * getIpLang(ipOrCode)
 * Returnerar språkkod baserat på ISO-landkod eller IP-prefix.
 * - Ingen extern API-anrop.
 * - Alltid säker: returnerar "UNKNOWN" om ingen match hittas.
 */
export function getIpLang(ipOrCode = "") {
  if (!ipOrCode) return "UNKNOWN";

  const val = ipOrCode.toString().toUpperCase();

  // Direkt mappning från landkod till språk
  const map = {
    SE: "SE", // Sverige
    DK: "DA", // Danmark
    DE: "DE", // Tyskland
    GB: "EN", // Storbritannien
    UK: "EN",
    US: "EN", // USA
    CA: "EN",
    IE: "EN",
    AU: "EN",
  };

  if (map[val]) return map[val];

  // Enkel heuristik baserat på IP-prefix (mockad offline-version)
  if (val.startsWith("192.168.") || val.startsWith("10.") || val.startsWith("83.") || val.startsWith("90.")) return "SE";
  if (val.startsWith("82.") || val.startsWith("87.") || val.startsWith("91.")) return "DA";
  if (val.startsWith("80.") || val.startsWith("84.")) return "DE";
  if (val.startsWith("172.") || val.startsWith("8.") || val.startsWith("3.")) return "EN";

  return "UNKNOWN";
}
