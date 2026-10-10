// Turns a Vaani webhook payload into a processed call. Shared by the local server and the Vercel function.
import { processCall } from './pipeline.mjs';
import { claim } from './store.mjs';

// Vaani transcript may be a string or a list of timestamped speaker lines.
export function transcriptText(t) {
  if (typeof t === 'string') return t;
  if (Array.isArray(t)) return t.map(l => (typeof l === 'string' ? l : `${l.speaker || l.role || ''}: ${l.text || l.content || ''}`)).join('\n');
  return '';
}

// The docs say call_duration is milliseconds, but live payloads looked like seconds. Values under 1000 are read as seconds.
export function toSeconds(v) {
  if (v == null || isNaN(v)) return null;
  return v >= 1000 ? Math.round(v / 1000) : Math.round(v);
}

export const describe = p => `event: ${p.event} call: ${p.call_id || p.data?.call_id || p.room_name || '-'}`;

// Returns a promise for the processed entry, or null when the event carries no transcript.
export async function handleEvent(p) {
  if (p?.event !== 'call_postprocessing') return null;
  const d = p.data || p; // docs nest under data, their example reads top level
  const id = d.call_id || p.call_id || d.room_name;
  if (!id || !(await claim(id))) return null;
  const transcript = transcriptText(d.transcript || d.transcription);
  return processCall({
    id, header: `Vaani call ${id} - ${p.timestamp || ''}`, transcript: transcript || d.summary || '',
    durationSec: toSeconds(d.call_duration),
  });
}
