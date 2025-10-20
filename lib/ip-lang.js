// /lib/ip-lang.js
// Lättviktig IP-profilering: ge språk-hint + trustnivå.
// Inga externa lookups – endast heuristik.
// Behåller bakåtkompatibel getIpLang(ip).

const PRIVATE_NETS = [
  /^10\./,
  /^192\.168\./,
  /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^127\./,
  /^::1$/,
];

function isPrivate(ip = "") {
  const s = String(ip || "").trim();
  if (!s) return false;
  return PRIVATE_NETS.some((re) => re.test(s));
}

function normalizeIp(ip) {
  if (!ip) return "";
  // Om vi får "x-forwarded-for" med flera IPs, ta första
  const raw = String(ip).split(",")[0].trim();
  // Ta bort eventuellt port-del (IPv4:port)
  return raw.replace(/:\d+$/, "");
}

// Enkel cc->lang mapping (lokal heuristik)
function ccToLang(cc) {
  if (!cc) return null;
  const C = cc.toUpperCase();
  if (C === "SE") return "SE";
  if (C === "DK") return "DA";
  if (C === "DE") return "DE";
  if (C === "NO") return "DA"; // norsk -> danska fallback
  if (C === "FI") return "SE"; // finsk -> svenska fallback
  if (C === "GB" || C === "US" || C === "IE" || C === "CA" || C === "AU" || C === "NZ") return "EN";
  return null;
}

/**
 * profileIp(ip)
 * @returns { cc, langHint, ipTrust, via }
 *
 * OBS: Vi har ingen riktig GeoIP här. Om ni senare har t.ex. Cloudflare headers
 * (cf-ipcountry) eller ett mmdb-uppslag kan ni plugga in det och sätta via accordingly.
 */
export function profileIp(ip) {
  const cleaned = normalizeIp(ip);

  if (!cleaned) {
    return { cc: "??", langHint: null, ipTrust: "LOW", via: "none" };
  }

  // Heuristik: privat nät = LOW trust
  if (isPrivate(cleaned)) {
    return { cc: "??", langHint: null, ipTrust: "LOW", via: "private" };
  }

  // Om ni har reverse proxy som sätter t.ex. CF-IPCountry i request headers
  // kan gate.js skicka in redan känd landkod i stället för IP. För nu: ingen cc.
  // Vi kan försöka gissa cc från TLD i IP? Nej, inte möjligt utan DB.
  // Därför: neutral profil men MEDIUM trust (publik IP).
  return { cc: "??", langHint: null, ipTrust: "MEDIUM", via: "ip-only" };
}

// Bakåtkompatibel wrapper
export function getIpLang(ip) {
  const p = profileIp(ip);
  return p.langHint || "UNKNOWN";
}
