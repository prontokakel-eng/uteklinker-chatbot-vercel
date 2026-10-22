// Retired public write route. Review drafts are prepared offline, never by clients.
export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(410).json({ error: 'FAQ_WRITE_DISABLED' });
}
