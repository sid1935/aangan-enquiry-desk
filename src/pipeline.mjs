// One call in -> qualify -> notify (if needed) -> log. Used by the webhook (local and Vercel) and the demo.
import { qualify } from './qualify.mjs';
import { formatNote, sendTelegram, NOTIFY } from './telegram.mjs';
import { appendEntry, readLog } from './store.mjs';
import { hubspotEnabled, syncCall } from './hubspot.mjs';

export { readLog };

// Parses "4 min 12 sec" style durations out of a call header.
export function durationFromHeader(h = '') {
  const m = h.match(/(\d+)\s*min(?:\s*(\d+)\s*sec)?/i);
  return m ? Number(m[1]) * 60 + Number(m[2] || 0) : null;
}

export async function processCall({ id, header = '', transcript, receivedAt = new Date(), durationSec = null, notify = true, crm = true }) {
  const t0 = Date.now();
  const { result, usage } = await qualify({ header, transcript });
  let telegram = 'not_needed', messageId = null, error = null;
  if (NOTIFY.has(result.decision)) {
    if (!notify) telegram = 'skipped';
    else {
      try { messageId = await sendTelegram(formatNote(id, result)); telegram = 'sent'; }
      catch (e) { telegram = 'failed'; error = e.message; }
    }
  }
  const entry = {
    id, header, receivedAt: new Date(receivedAt).toISOString(), processedAt: new Date().toISOString(),
    // seconds from the call ending to a human (or the caller) having the outcome
    processingSec: Number(((Date.now() - t0) / 1000).toFixed(1)),
    callDurationSec: durationSec ?? durationFromHeader(header),
    decision: result.decision, urgency: result.urgency, flags: result.flags, criteria: result.criteria,
    extracted: result.extracted, reasons: result.reasons, handoff_note: result.handoff_note,
    reply_to_caller: result.reply_to_caller, next_action: result.next_action,
    usage, telegram, messageId, error,
  };
  // CRM sync is best-effort: a HubSpot problem is recorded on the call, never thrown
  if (crm && hubspotEnabled()) entry.hubspot = await syncCall(entry);
  await appendEntry(entry);
  return entry;
}
