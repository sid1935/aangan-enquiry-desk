// Pushes all 20 September phone transcripts through the full pipeline. Resets the call log first.
// Usage: node src/demo.mjs [--no-telegram] [T01 T05 ...]
// With SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY set it fills the Supabase log (the deployed dashboard); otherwise data/log.jsonl.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { processCall } from './pipeline.mjs';
import { resetLog, backend } from './store.mjs';
try { process.loadEnvFile(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env')); } catch {}

const args = process.argv.slice(2);
const notify = !args.includes('--no-telegram');
const only = args.filter(a => /^T\d\d$/.test(a));
const calls = JSON.parse(fs.readFileSync('data/calls.json', 'utf8')).filter(c => !only.length || only.includes(c.id));
const expected = JSON.parse(fs.readFileSync('data/expected.json', 'utf8'));

if (!only.length) await resetLog();
let sent = 0;
for (const c of calls) {
  const e = await processCall({ id: c.id, header: c.header, transcript: c.transcript, notify });
  if (e.telegram === 'sent') sent++;
  console.log(`${e.decision === expected[c.id] ? 'OK  ' : 'DIFF'} ${c.id} ${e.decision.padEnd(15)} telegram=${e.telegram}${e.error ? ' ERR ' + e.error : ''}`);
  await new Promise(r => setTimeout(r, notify ? 1200 : 0)); // stay clear of Telegram rate limits
}
console.log(`\nDone. ${calls.length} calls processed, ${sent} Telegram messages sent. Log backend: ${backend()}`);
