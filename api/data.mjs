// Vercel function: dashboard data. Password protected, because it holds caller names and phone numbers.
import { readLog } from '../src/store.mjs';
import { dashboardAuthorised, challenge } from '../src/auth.mjs';

export default async function handler(req, res) {
  if (!dashboardAuthorised(req)) return challenge(res);
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify({ calls: await readLog(), generatedAt: new Date().toISOString() }));
}
