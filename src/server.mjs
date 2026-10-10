// Local webhook receiver for Vaani. Vaani has no signature, so the URL carries a secret: POST /webhook/<WEBHOOK_SECRET>
// On Vercel the same logic runs as api/webhook.mjs.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleEvent, describe } from './vaani.mjs';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
try { process.loadEnvFile(path.join(root, '.env')); } catch {}

const PORT = Number(process.env.PORT || 3000);
const SECRET = process.env.WEBHOOK_SECRET;
const RAW_FILE = path.join(root, 'data', 'webhook-raw.jsonl');
if (!SECRET) { console.error('Set WEBHOOK_SECRET in .env'); process.exit(1); }

http.createServer((req, res) => {
  if (req.method !== 'POST' || req.url !== `/webhook/${SECRET}`) { res.writeHead(404).end(); return; }
  let body = '';
  req.on('data', d => { body += d; if (body.length > 2e6) req.destroy(); });
  req.on('end', () => {
    res.writeHead(200).end('ok'); // acknowledge fast; process after
    let p; try { p = JSON.parse(body); } catch { return console.log('bad json'); }
    console.log(new Date().toISOString(), describe(p));
    fs.appendFileSync(RAW_FILE, JSON.stringify({ at: new Date().toISOString(), payload: p }) + '\n'); // kept so payload formats can be checked
    handleEvent(p).then(e => e && console.log(e.id, e.decision, e.telegram)).catch(e => console.error('FAILED', e.message));
  });
}).listen(PORT, () => console.log(`Listening on :${PORT}`));
