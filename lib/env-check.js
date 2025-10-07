// lib/env-check.js

/**
 * Validerar att alla nödvändiga ENV-variabler finns
 * och normaliserar (trim) deras värden direkt i process.env.
 *
 * @param {Array<string | string[]>} requiredVars
 *    - Lista av strängar eller aliaslistor, t.ex. ["OPENAI_API_KEY", ["SHEET_ID", "GOOGLE_SHEET_ID"]]
 */
export function validateEnv(requiredVars = []) {
  for (const item of requiredVars) {
    // Tillåt både strängar och listor med alias
    const names = Array.isArray(item) ? item : [item];

    // Leta efter första env som faktiskt finns
    const foundName = names.find((n) => process.env[n]);
    const val = foundName ? process.env[foundName] : null;

    if (!val) {
      throw new Error(`❌ Missing ENV var: tried ${names.join(" or ")}`);
    }

    // Trimma värdet
    const trimmed = val.trim();

    // Om vi hittade whitespace → korrigera och varna
    if (val.length !== trimmed.length) {
      console.warn(`⚠️ ENV var "${foundName}" hade whitespace, korrigerar automatiskt.`);
    }

    // Skriv tillbaka till process.env så resten av appen får det rätta värdet
    process.env[foundName] = trimmed;

    // Logga längd istället för värde (säkerhet)
    console.log(`✅ ${foundName} loaded (length: ${trimmed.length})`);
  }
}
