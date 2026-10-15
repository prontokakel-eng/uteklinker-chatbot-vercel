import { getStoreContact } from '../lib/store-contact.js';
import { createRateLimiter } from '../lib/rate-limiter.js';
const limitContact = createRateLimiter();
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method Not Allowed' }); }
  const ip = String(req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress || 'anon').split(',')[0].trim();
  const limit = await limitContact(ip);
  if (limit.limited) { res.setHeader('Retry-After', String(limit.retryAfter)); return res.status(429).json({ error: 'Contact rate limited' }); }
  return res.status(200).json(await getStoreContact({ lang: req.query?.lang }));
}
