// Call log storage. Redis (Upstash REST) when configured, otherwise a local JSONL file.
// Vercel functions have no writable disk, so production uses Redis; local dev uses the file.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const LOG_FILE = path.join(root, 'data', 'log.jsonl');

const URL_ = () => process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOKEN = () => process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
export const backend = () => (URL_() && TOKEN() ? 'redis' : 'file');

async function redis(commands) {
  const res = await fetch(`${URL_()}/pipeline`, {
    method: 'POST', headers: { Authorization: `Bearer ${TOKEN()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(commands),
  });
  if (!res.ok) throw new Error(`Redis ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const out = await res.json();
  const bad = out.find(r => r.error);
  if (bad) throw new Error(`Redis: ${bad.error}`);
  return out.map(r => r.result);
}

const seenLocal = new Set();

// True the first time an id is seen. Vaani's retry behaviour is undocumented, so duplicates are dropped.
export async function claim(id) {
  if (backend() === 'redis') return (await redis([['SET', `seen:${id}`, '1', 'NX', 'EX', '86400']]))[0] === 'OK';
  if (seenLocal.has(id)) return false;
  seenLocal.add(id); return true;
}

export async function appendEntry(entry) {
  if (backend() === 'redis') {
    await redis([['SET', `call:${entry.id}`, JSON.stringify(entry)], ['ZADD', 'calls', String(Date.parse(entry.receivedAt) || Date.now()), entry.id]]);
    return;
  }
  fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
  fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n');
}

export async function readLog() {
  if (backend() === 'redis') {
    const [ids] = await redis([['ZRANGE', 'calls', '0', '-1']]);
    if (!ids.length) return [];
    const [rows] = await redis([['MGET', ...ids.map(i => `call:${i}`)]]);
    return rows.filter(Boolean).map(r => JSON.parse(r));
  }
  if (!fs.existsSync(LOG_FILE)) return [];
  return fs.readFileSync(LOG_FILE, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
}

export async function resetLog() {
  if (backend() === 'redis') {
    const [ids] = await redis([['ZRANGE', 'calls', '0', '-1']]);
    await redis([['DEL', 'calls', ...ids.map(i => `call:${i}`)]]);
    return;
  }
  if (fs.existsSync(LOG_FILE)) fs.unlinkSync(LOG_FILE);
}
