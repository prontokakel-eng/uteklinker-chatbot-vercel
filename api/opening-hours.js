import { getWebsiteOpeningHours } from '../lib/website-opening-hours.js';
import { createRateLimiter } from '../lib/rate-limiter.js';
const limit = createRateLimiter({ limit: 30 });
const origins = new Set(['https://klinkerdack.se', 'https://www.klinkerdack.se']);
export function createOpeningHoursHandler({ load = getWebsiteOpeningHours, rateLimit = limit } = {}) {
  return async function handler(req, res) {
    res.setHeader('Cache-Control', 'no-store');
    res.setHeader('Vary', 'Origin');
    const origin = req.headers?.origin;
    if (origin && !origins.has(origin)) return res.status(403).json({ error: 'Origin not allowed' });
    if (origin) res.setHeader('Access-Control-Allow-Origin', origin);
    if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method Not Allowed' }); }
    const ip = String(req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || 'anon').split(',')[0].trim();
    const limited = await rateLimit(ip);
    if (limited.limited) { res.setHeader('Retry-After', String(limited.retryAfter)); return res.status(429).json({ error: 'Rate limited' }); }
    const lang = ['SE','DA','DE','EN'].includes(req.query?.lang) ? req.query.lang : 'SE';
    return res.status(200).json(await load({ lang }));
  };
}
export default createOpeningHoursHandler();
