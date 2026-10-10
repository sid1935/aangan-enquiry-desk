// HTTP Basic auth for the dashboard. Any username; the password is DASHBOARD_PASSWORD. Fails closed if it is not set.
import crypto from 'node:crypto';

const sha = s => crypto.createHash('sha256').update(String(s)).digest();
export const safeEqual = (a, b) => crypto.timingSafeEqual(sha(a), sha(b));

export function dashboardAuthorised(req) {
  const pw = process.env.DASHBOARD_PASSWORD;
  if (!pw) return false;
  const h = req.headers.authorization || '';
  if (!h.startsWith('Basic ')) return false;
  const given = Buffer.from(h.slice(6), 'base64').toString().split(':').slice(1).join(':');
  return safeEqual(given, pw);
}

export function challenge(res) {
  res.statusCode = 401;
  res.setHeader('WWW-Authenticate', 'Basic realm="Aangan Enquiry Desk"');
  res.end('Authentication required');
}
