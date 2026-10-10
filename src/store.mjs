// Call log storage. Supabase (Postgres over its REST API) when configured, otherwise a local JSONL file.
// Vercel functions have no writable disk, so production uses Supabase; local dev uses the file.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
export const LOG_FILE = path.join(root, 'data', 'log.jsonl');

// Vercel's Supabase integration sets SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.
const URL_ = () => (process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || '').replace(/\/$/, '');
const KEY = () => process.env.SUPABASE_SERVICE_ROLE_KEY;
export const backend = () => (URL_() && KEY() ? 'supabase' : 'file');

async function sb(method, pathAndQuery, { body, prefer } = {}) {
  const res = await fetch(`${URL_()}/rest/v1/${pathAndQuery}`, {
    method,
    headers: {
      apikey: KEY(), Authorization: `Bearer ${KEY()}`, 'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Supabase ${method} ${pathAndQuery.split('?')[0]} ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

const seenLocal = new Set();

// True the first time an id is seen. Vaani's retry behaviour is undocumented, so duplicates are dropped.
export async function claim(id) {
  if (backend() === 'supabase') {
    const rows = await sb('POST', 'seen?on_conflict=id', { body: [{ id }], prefer: 'resolution=ignore-duplicates,return=representation' });
    return rows.length === 1; // an ignored duplicate returns no row
  }
  if (seenLocal.has(id)) return false;
  seenLocal.add(id); return true;
}

export async function appendEntry(entry) {
  if (backend() === 'supabase') {
    await sb('POST', 'calls?on_conflict=id', {
      body: [{ id: entry.id, received_at: entry.receivedAt, data: entry }], prefer: 'resolution=merge-duplicates',
    });
    return;
  }
  fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
  fs.appendFileSync(LOG_FILE, JSON.stringify(entry) + '\n');
}

export async function readLog() {
  if (backend() === 'supabase') {
    const rows = await sb('GET', 'calls?select=data&order=received_at.asc&limit=5000');
    return rows.map(r => r.data);
  }
  if (!fs.existsSync(LOG_FILE)) return [];
  return fs.readFileSync(LOG_FILE, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
}

export async function resetLog() {
  if (backend() === 'supabase') {
    await sb('DELETE', 'calls?id=not.is.null');
    await sb('DELETE', 'seen?id=not.is.null');
    return;
  }
  if (fs.existsSync(LOG_FILE)) fs.unlinkSync(LOG_FILE);
}
