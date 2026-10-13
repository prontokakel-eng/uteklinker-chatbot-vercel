import { getStoreContact } from '../lib/store-contact.js';
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ error: 'Method Not Allowed' }); }
  return res.status(200).json(await getStoreContact({ lang: req.query?.lang }));
}
