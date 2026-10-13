// Per-instance fallback. Configure Vercel Firewall for fleet-wide enforcement.
export function createRateLimiter({ now = Date.now, windowMs = 60000, limit = 10 } = {}) {
  const requests = new Map();
  return async function checkRateLimit(ip = 'anon') {
    const time = now();
    for (const [key, record] of requests) if (record.expires <= time) requests.delete(key);
    const record = requests.get(ip) || { count: 0, expires: time + windowMs };
    record.count++;
    requests.set(ip, record);
    return { limited: record.count > limit, reason: 'Du har skickat många frågor. Vänta en minut och försök igen.', via: 'rate-limit', retryAfter: Math.max(1, Math.ceil((record.expires - time) / 1000)) };
  };
}
export const checkRateLimit = createRateLimiter();
