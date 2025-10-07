// api/test-google.js
import { loadFaqFromSheet } from "./../lib/utils.js";

export default async function handler(req, res) {
  try {
    const data = await loadFaqFromSheet("SE");
    res.status(200).json({
      ok: true,
      count: data.length,
      sample: data[0] || null,
    });
  } catch (err) {
    res.status(500).json({
      ok: false,
      error: err.message,
    });
  }
}
