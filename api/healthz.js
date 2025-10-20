export default async function handler(req, res) {
  const checks = {
    time: new Date().toISOString(),
    env: {
      OPENAI: !!process.env.OPENAI_API_KEY,
      GCP: !!process.env.GCP_PROJECT_ID
    },
    // Lägg till fler: Sheets reachability (ping mock), cache status etc.
  };
  res.status(200).json({ ok: true, checks });
}
