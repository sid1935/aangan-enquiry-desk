// Local dashboard server. Bound to 127.0.0.1 ONLY and on its own port, so a public webhook tunnel never exposes caller data.
// Serves the same static pages as Vercel (public/) plus /api/data, with the same clean URLs.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readLog } from './pipeline.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
try { process.loadEnvFile(path.join(root, '.env')); } catch {}
const PORT = Number(process.env.DASHBOARD_PORT || 3001);
const pub = path.join(root, 'public');
const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };
const PAGES = { '/': 'index.html', '/calls': 'calls.html', '/call': 'call.html', '/costs': 'costs.html', '/how-it-works': 'how-it-works.html' };

http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  if (pathname === '/api/data') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify({ calls: await readLog(), generatedAt: new Date().toISOString() }));
  }
  const rel = PAGES[pathname] || (pathname.startsWith('/assets/') ? pathname.slice(1) : null);
  const file = rel && path.join(pub, rel);
  if (!file || !file.startsWith(pub) || !fs.existsSync(file)) { res.writeHead(404, { 'Content-Type': 'text/plain' }); return res.end('Not found'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  res.end(fs.readFileSync(file));
}).listen(PORT, '127.0.0.1', () => console.log(`Dashboard: http://localhost:${PORT}`));
