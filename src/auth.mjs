// Optional HTTP Basic auth for the dashboard. Any username; the password is DASHBOARD_PASSWORD.
// If DASHBOARD_PASSWORD is NOT set the dashboard is public, so anyone with the URL sees caller details.
import crypto from 'node:crypto';

const sha = s => crypto.createHash('sha256').update(String(s)).digest();
export const safeEqual = (a, b) => crypto.timingSafeEqual(sha(a), sha(b));

export function dashboardAuthorised(req) {
  const pw = process.env.DASHBOARD_PASSWORD;
  if (!pw) return true; // no password configured: open dashboard
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
