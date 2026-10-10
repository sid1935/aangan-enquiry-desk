// Vercel function: the dashboard page, behind the same password.
import fs from 'node:fs';
import path from 'node:path';
import { dashboardAuthorised, challenge } from '../src/auth.mjs';

const page = () => {
  const p = [path.join(process.cwd(), 'views', 'dashboard.html'), path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'views', 'dashboard.html')].find(fs.existsSync);
  return fs.readFileSync(p, 'utf8');
};

export default function handler(req, res) {
  if (!dashboardAuthorised(req)) return challenge(res);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(page());
}
