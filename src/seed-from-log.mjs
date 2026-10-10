// Uploads the already-processed T01-T20 results from the local log (data/log.jsonl) into Supabase.
// No Gemini calls and no Telegram messages. Live calls and test entries in the local log are skipped, and existing
// Supabase rows are not deleted (rows are upserted by id, so running it twice is safe).
// Needs SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { appendEntry, backend } from './store.mjs';
try { process.loadEnvFile(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env')); } catch {}

if (backend() !== 'supabase') {
  console.error('Supabase is not configured. Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to .env, then run again.');
  process.exit(1);
}
const file = 'data/log.jsonl';
if (!fs.existsSync(file)) { console.error(`${file} not found. Run: npm run demo -- --no-telegram`); process.exit(1); }

const entries = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)).filter(e => /^T\d\d$/.test(e.id));
let done = 0;
for (const e of entries) { await appendEntry(e); done++; console.log('uploaded', e.id, e.decision); }
console.log(`\nDone: ${done} calls upserted into Supabase.`);
