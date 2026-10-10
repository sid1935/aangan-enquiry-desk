// Pushes calls that are not yet in HubSpot (new, previously failed, or the September calls) into HubSpot, then saves the HubSpot ids.
// Safe to run repeatedly: calls already synced are skipped, and a half-finished call resumes where it stopped.
// Usage: npm run hubspot:sync [-- --dry-run] [T01 T05 ...]
// Needs HUBSPOT_TOKEN, and SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY to read and update the live log.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readLog } from './pipeline.mjs';
import { appendEntry, backend } from './store.mjs';
import { hubspotEnabled, syncCall } from './hubspot.mjs';
try { process.loadEnvFile(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env')); } catch {}

const args = process.argv.slice(2);
const dry = args.includes('--dry-run');
const only = args.filter(a => /^T\d\d$/.test(a));
if (!hubspotEnabled()) { console.error('HUBSPOT_TOKEN is not set. Add it to .env first.'); process.exit(1); }

const todo = (await readLog()).filter(e => (!only.length || only.includes(e.id)) && !e.hubspot?.ok);
console.log(`Log backend: ${backend()}. ${todo.length} call(s) to sync${dry ? ' (dry run, nothing will be sent)' : ''}.`);
let ok = 0, failed = 0;
for (const e of todo) {
  if (dry) { console.log('would sync', e.id, e.decision); continue; }
  e.hubspot = await syncCall(e, e.hubspot);
  await appendEntry(e); // upsert: saves the HubSpot ids, even after a partial failure
  if (e.hubspot.ok) { ok++; console.log('synced ', e.id.padEnd(30), e.decision.padEnd(16), 'contact', e.hubspot.contactId, e.hubspot.dealId ? 'deal ' + e.hubspot.dealId : '', e.hubspot.taskId ? 'task ' + e.hubspot.taskId : ''); }
  else { failed++; console.log('FAILED ', e.id, e.hubspot.error); }
  await new Promise(r => setTimeout(r, 400)); // stay well inside HubSpot's rate limit
}
if (!dry) console.log(`\nDone: ${ok} synced, ${failed} failed.`);
process.exitCode = failed ? 1 : 0; // not process.exit(): on Windows it can trip a libuv assertion while connections close
