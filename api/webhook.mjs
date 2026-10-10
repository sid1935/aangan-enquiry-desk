// Vercel function: Vaani webhook. URL is /webhook/<WEBHOOK_SECRET> (rewritten in vercel.json).
import { waitUntil } from '@vercel/functions';
import { handleEvent, describe } from '../src/vaani.mjs';
import { safeEqual } from '../src/auth.mjs';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  const secret = process.env.WEBHOOK_SECRET;
  if (req.method !== 'POST' || !secret || !req.query.secret || !safeEqual(req.query.secret, secret)) {
    res.statusCode = 404; return res.end();
  }
  let p = req.body;
  if (typeof p === 'string') { try { p = JSON.parse(p); } catch { p = null; } }
  if (!p) { res.statusCode = 400; return res.end('bad json'); }

  console.log(describe(p));
  // Acknowledge now, keep working after the response. waitUntil stops Vercel freezing the function mid-call.
  waitUntil(handleEvent(p).then(e => e && console.log(e.id, e.decision, e.telegram)).catch(e => console.error('FAILED', e.message)));
  res.statusCode = 200; res.end('ok');
}
