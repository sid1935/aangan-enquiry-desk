// Telegram handoff: formats the brain's output as a designer note and sends it.
import path from 'node:path';
import { fileURLToPath } from 'node:url';
try { process.loadEnvFile(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '.env')); } catch {}

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const FLAG_LABEL = {
  pricing_asked: 'asked for price (deflected)', complaint: 'complaint', repeat_caller: 'repeat caller',
  proxy_caller: 'calling for someone else', budget_mismatch: 'budget mismatch', dropped_call: 'call dropped',
  after_hours: 'after hours', referral: 'referral', timeline_tight: 'tight timeline', large_project: 'large project',
};
const HEAD = {
  forward: ['\u{1F7E2}', 'NEW LEAD for designer'],
  escalate: ['\u{1F6A8}', 'ESCALATION - call back within 15 min'],
  callback_needed: ['\u{1F4DE}', 'MISSED CALL - call back'],
};

// Only these decisions interrupt a human. Declines and nurture leads are logged, not pushed.
export const NOTIFY = new Set(Object.keys(HEAD));

export function formatNote(callId, r) {
  const [icon, title] = HEAD[r.decision];
  const e = r.extracted || {};
  const line = (k, v) => (v ? `<b>${k}:</b> ${esc(v)}\n` : '');
  const crit = r.criteria || {};
  const unclear = Object.entries(crit).filter(([, v]) => v === 'unclear').map(([k]) => k.replace('_', ' '));
  return (
    `${icon} <b>${title}</b>  <i>(${esc(callId)})</i>\n\n` +
    line('Name', e.caller_name) + line('Phone', e.phone) + line('Location', e.location) +
    line('Project', e.project_type) + line('Size', e.size_sqft ? `${e.size_sqft} sq ft` : null) +
    line('Timeline', e.timeline) + line('Owner', e.owner_status) + line('Referral', e.referral_source) +
    line('Preferred slots', e.preferred_slots) +
    (r.flags?.length ? `<b>Flags:</b> ${r.flags.map(f => esc(FLAG_LABEL[f] || f)).join(', ')}\n` : '') +
    (unclear.length ? `<b>Unclear:</b> ${esc(unclear.join(', '))}\n` : '') +
    `\n${esc(r.handoff_note)}\n\n<b>Next:</b> ${esc(r.next_action)}`
  );
}

export async function sendTelegram(html) {
  const { TELEGRAM_BOT_TOKEN: token, TELEGRAM_CHAT_ID: chat } = process.env;
  if (!token || !chat) throw new Error('Telegram token/chat id missing in .env');
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chat, text: html, parse_mode: 'HTML', disable_web_page_preview: true }),
  });
  const j = await res.json();
  if (!j.ok) throw new Error(`Telegram: ${j.description}`);
  return j.result.message_id;
}
