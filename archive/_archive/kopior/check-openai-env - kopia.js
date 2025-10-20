// /lib/check-openai-env.js
// Säkerhetsvakt: varnar om PowerShell/OS redan har OpenAI-nycklar satta i RAM.
// Körs automatiskt från load-env.js

export function checkOpenAIEnvConflicts() {
  const keys = ["OPENAI_API_KEY", "OPENAI_PROJECT_ID"];
  let foundConflict = false;

  for (const key of keys) {
    const val = process.env[key];
    if (val && val.startsWith("sk-proj-1d")) {
      console.warn(
        `⚠️  ${key} already defined in PowerShell environment (starts with ${val.slice(0, 10)}...).`
      );
      console.warn(
        `   ➜ .env.local value will be ignored for this run.\n   ➜ To clear it: Remove-Item Env:${key}\n`
      );
      foundConflict = true;
    }
  }

  if (!foundConflict) {
    console.log("✅ No OpenAI env conflicts detected in PowerShell environment.");
  }
}
