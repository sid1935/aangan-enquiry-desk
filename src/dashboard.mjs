// Local dashboard server. Bound to 127.0.0.1 ONLY and on its own port, so the public webhook tunnel (port 3000) never exposes caller data.
// On Vercel the same page is served, behind a password, by api/dashboard.mjs and api/data.mjs.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readLog } from './pipeline.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
try { process.loadEnvFile(path.join(root, '.env')); } catch {}
const PORT = Number(process.env.DASHBOARD_PORT || 3001);

http.createServer(async (req, res) => {
  if (req.url === '/api/data') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify({ calls: await readLog(), generatedAt: new Date().toISOString() }));
  }
  if (req.url === '/' || req.url === '/index.html') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(fs.readFileSync(path.join(root, 'views', 'dashboard.html')));
  }
  res.writeHead(404).end();
}).listen(PORT, '127.0.0.1', () => console.log(`Dashboard: http://localhost:${PORT}`));
