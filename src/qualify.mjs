// Qualification brain: call transcript in -> structured decision, flags and handoff note out (Gemini).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
try { process.loadEnvFile(path.join(root, '.env')); } catch {}

export const MODEL = process.env.GEMINI_MODEL || 'gemini-3.8-flash';
// ESTIMATES in USD per 1M tokens. Verify against Google's current pricing page and set in .env.
const PRICE_IN = Number(process.env.PRICE_IN_PER_M || 0.3);
const PRICE_OUT = Number(process.env.PRICE_OUT_PER_M || 2.5);

// On Vercel the bundle layout can differ, so fall back to the working directory.
const base = [root, process.cwd()].find(b => fs.existsSync(path.join(b, 'knowledge', 'services.md'))) || root;
const services = fs.readFileSync(path.join(base, 'knowledge/services.md'), 'utf8');
const qualified = fs.readFileSync(path.join(base, 'knowledge/qualified.md'), 'utf8');
// pricing.md is deliberately NOT loaded: the AI must never have, or quote, a price.

const SYSTEM = `You are the call-qualification engine for Aangan Studio, an interior design studio in Pune.
You receive the transcript of ONE incoming phone call (or a missed-call record) and decide what happens next.
Follow the studio's own documents exactly.

=== SERVICES ===
${services}

=== QUALIFICATION RUBRIC (written by the founder) ===
${qualified}

=== ADDITIONAL RULES ===
- Execution lead time: the site must be available for execution within 8-10 weeks of the consultation (use the rubric, not the 6-week line).
- Commercial spaces under about 500 sq ft are below our minimum scope: treat as a failed "real project" criterion. Offices over about 3,000 sq ft are also out of scope.
- NEVER output or imply any price, range or per-sq-ft figure. Asking for a price is a flag (pricing_asked), never a disqualifier.
- A caller who is an existing client complaining about a live project is NOT a lead: decision = "escalate".
- A missed call or no-answer record is decision = "callback_needed".

=== DECISIONS ===
- "forward": passes the criteria (or unclear only on budget / decision-maker, which are noted not blocking). Goes to a designer.
- "decline": fails the service-area or real-project criterion, is out of scope (restaurant, hotel, retail, gym, too small/large), has a volunteered budget clearly too low, or fails two or more criteria.
- "nurture": fits the studio in principle but the timeline cannot work now and the caller might return (e.g. needs it done in weeks but could start later).
- "escalate": existing-client complaint or anything needing the founder immediately.
- "callback_needed": call was missed or dropped with no usable details.
If a caller called twice (e.g. a dropped call then a call back), treat it as ONE enquiry using the combined details and set dropped_call.

Criteria values: "pass", "fail" or "unclear". Use null for facts not stated. Do not invent facts.
The handoff_note is written for the designer in 4-6 short lines: who, what and where, size, timeline, owner status, flags, and the suggested next step. Never include a price. For decline/nurture, write a one-line closing note instead.
reply_to_caller is what should be said or sent back to the caller in one or two sentences, in a warm, brief tone (a decline must be graceful; a price question must use: "Pricing depends on the site, the materials you choose, and the scope - your designer will walk you through it in detail at the consultation. I can book that for you right now if you'd like.").`;

const S = (type, extra = {}) => ({ type, ...extra });
const NS = { type: 'STRING', nullable: true };
const CRIT = { type: 'STRING', enum: ['pass', 'fail', 'unclear'] };
const SCHEMA = {
  type: 'OBJECT',
  properties: {
    decision: { type: 'STRING', enum: ['forward', 'decline', 'nurture', 'escalate', 'callback_needed'] },
    urgency: { type: 'STRING', enum: ['high', 'normal', 'low'] },
    reasons: { type: 'ARRAY', items: { type: 'STRING' } },
    criteria: {
      type: 'OBJECT',
      properties: { real_project: CRIT, service_area: CRIT, timeline: CRIT, budget: CRIT, decision_maker: CRIT },
      required: ['real_project', 'service_area', 'timeline', 'budget', 'decision_maker'],
    },
    extracted: {
      type: 'OBJECT',
      properties: {
        caller_name: NS, phone: NS, location: NS, project_type: NS, size_sqft: { type: 'NUMBER', nullable: true },
        timeline: NS, owner_status: NS, budget_mentioned: NS, referral_source: NS, preferred_slots: NS,
      },
      required: ['caller_name', 'phone', 'location', 'project_type', 'size_sqft', 'timeline', 'owner_status', 'budget_mentioned', 'referral_source', 'preferred_slots'],
    },
    flags: {
      type: 'ARRAY',
      items: { type: 'STRING', enum: ['pricing_asked', 'complaint', 'repeat_caller', 'proxy_caller', 'budget_mismatch', 'dropped_call', 'after_hours', 'referral', 'timeline_tight', 'large_project'] },
    },
    handoff_note: { type: 'STRING' },
    reply_to_caller: { type: 'STRING' },
    next_action: { type: 'STRING' },
  },
  required: ['decision', 'urgency', 'reasons', 'criteria', 'extracted', 'flags', 'handoff_note', 'reply_to_caller', 'next_action'],
};

export async function qualify({ header = '', transcript }) {
  const key = process.env.LLM_API_KEY;
  if (!key) throw new Error('LLM_API_KEY missing in .env');
  const body = {
    systemInstruction: { parts: [{ text: SYSTEM }] },
    contents: [{ role: 'user', parts: [{ text: `Call record: ${header}\n\n${transcript}` }] }],
    generationConfig: { temperature: 0, responseMimeType: 'application/json', responseSchema: SCHEMA, maxOutputTokens: 8192 },
  };
  const t0 = Date.now();
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`, {
      method: 'POST', headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    });
    if (res.status === 429 || res.status >= 500) { lastErr = new Error(`Gemini ${res.status}`); await new Promise(r => setTimeout(r, 2000 * (attempt + 1))); continue; }
    const json = await res.json();
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${JSON.stringify(json.error || json).slice(0, 300)}`);
    const text = json.candidates?.[0]?.content?.parts?.filter(p => p.text).map(p => p.text).join('') || '';
    const u = json.usageMetadata || {};
    const tokensIn = u.promptTokenCount || 0;
    const tokensOut = (u.candidatesTokenCount || 0) + (u.thoughtsTokenCount || 0);
    return {
      result: JSON.parse(text),
      usage: { model: MODEL, tokensIn, tokensOut, costUsd: (tokensIn * PRICE_IN + tokensOut * PRICE_OUT) / 1e6, latencyMs: Date.now() - t0 },
    };
  }
  throw lastErr;
}
