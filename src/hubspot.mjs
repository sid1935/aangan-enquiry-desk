// HubSpot CRM sync. Off unless HUBSPOT_TOKEN is set (a Private App access token).
//   forward                      -> Contact + Deal + Note
//   escalate / callback_needed   -> Contact + Task + Note
//   decline / nurture            -> Contact + Note
// Every step records its HubSpot id as it goes, so a retry resumes instead of creating duplicates.
// A HubSpot failure never blocks the call pipeline: it is recorded on the call and can be retried with `npm run hubspot:sync`.
const BASE = 'https://api.hubapi.com';
const token = () => process.env.HUBSPOT_TOKEN;
export const hubspotEnabled = () => !!token();

// HubSpot-defined association type ids (from the object to the contact or deal it points at).
const ASSOC = { dealToContact: 3, taskToContact: 204, noteToContact: 202, noteToDeal: 214 };
const assoc = (id, typeId) => ({ to: { id: String(id) }, types: [{ associationCategory: 'HUBSPOT_DEFINED', associationTypeId: typeId }] });

async function hs(method, path, body, attempt = 0) {
  const res = await fetch(BASE + path, {
    method, headers: { Authorization: `Bearer ${token()}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 429 && attempt < 2) { await new Promise(r => setTimeout(r, 1200 * (attempt + 1))); return hs(method, path, body, attempt + 1); }
  const text = await res.text();
  if (!res.ok) throw new Error(`HubSpot ${method} ${path.split('?')[0]} ${res.status}: ${text.slice(0, 220)}`);
  return text ? JSON.parse(text) : null;
}

let stageCache;
async function firstDealStage() {
  if (stageCache) return stageCache;
  const { results } = await hs('GET', '/crm/v3/pipelines/deals');
  const p = results.find(x => x.id === 'default') || results[0];
  const s = [...p.stages].sort((a, b) => a.displayOrder - b.displayOrder)[0];
  return (stageCache = { pipeline: p.id, dealstage: s.id });
}

const shortId = id => (/^T\d\d$/.test(id) ? id : '#' + (String(id).split('-').pop() || id).slice(0, 4).toUpperCase());
const LEAD_STATUS = { forward: 'NEW', escalate: 'NEW', callback_needed: 'NEW', decline: 'UNQUALIFIED', nurture: 'BAD_TIMING' };
const LABEL = { forward: 'Forwarded to designer', decline: 'Declined', nurture: 'Nurture', escalate: 'Escalated', callback_needed: 'Callback needed' };

function splitName(name, id) {
  const n = String(name || '').trim().replace(/\s+/g, ' ');
  if (!n) return { firstname: 'Caller', lastname: shortId(id) };
  const i = n.indexOf(' ');
  return i < 0 ? { firstname: n, lastname: '' } : { firstname: n.slice(0, i), lastname: n.slice(i + 1) };
}

function noteBody(c) {
  const e = c.extracted || {};
  const rows = [['Outcome', LABEL[c.decision]], ['Call', c.id], ['Project', e.project_type], ['Location', e.location], ['Size', e.size_sqft ? e.size_sqft + ' sq ft' : null],
    ['Timeline', e.timeline], ['Owner', e.owner_status], ['Budget said', e.budget_mentioned], ['Heard of us', e.referral_source], ['Preferred slots', e.preferred_slots],
    ['Flags', (c.flags || []).join(', ')]].filter(([, v]) => v);
  const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
  return `<p><b>Aangan Enquiry Desk</b></p>` + rows.map(([k, v]) => `<p>${esc(k)}: ${esc(v)}</p>`).join('')
    + `<p><b>Handoff note</b><br>${esc(c.handoff_note || '').replace(/\n/g, '<br>')}</p><p><b>Next step</b><br>${esc(c.next_action || '')}</p>`;
}

export async function syncCall(c, existing = {}) {
  const h = { ...existing };
  const e = c.extracted || {};
  try {
    // 1. contact
    if (!h.contactId) {
      let found = null;
      if (e.phone) {
        const r = await hs('POST', '/crm/v3/objects/contacts/search', { filterGroups: [{ filters: [{ propertyName: 'phone', operator: 'EQ', value: String(e.phone) }] }], limit: 1 });
        found = r.results?.[0] || null;
      }
      if (found) { h.contactId = found.id; h.contactReused = true; }
      else {
        const { firstname, lastname } = splitName(e.caller_name, c.id);
        const props = { firstname, lastname, lifecyclestage: 'lead', hs_lead_status: LEAD_STATUS[c.decision] || 'NEW' };
        if (e.phone) props.phone = String(e.phone);
        if (e.location) props.city = String(e.location).slice(0, 100);
        h.contactId = (await hs('POST', '/crm/v3/objects/contacts', { properties: props })).id;
      }
    }
    // 2. deal, for leads only
    if (c.decision === 'forward' && !h.dealId) {
      const stage = await firstDealStage();
      const title = [e.caller_name || `Caller ${shortId(c.id)}`, e.project_type, e.location].filter(Boolean).join(' · ').slice(0, 250);
      h.dealId = (await hs('POST', '/crm/v3/objects/deals', {
        properties: { dealname: title, ...stage, description: String(c.handoff_note || '').slice(0, 4000) },
        associations: [assoc(h.contactId, ASSOC.dealToContact)],
      })).id;
    }
    // 3. task, for calls that need a human to call back
    if ((c.decision === 'escalate' || c.decision === 'callback_needed') && !h.taskId) {
      const urgent = c.decision === 'escalate';
      const due = new Date(Date.now() + (urgent ? 15 : 120) * 60e3).toISOString();
      h.taskId = (await hs('POST', '/crm/v3/objects/tasks', {
        properties: {
          hs_task_subject: `${urgent ? 'URGENT: ' : ''}${urgent ? 'Escalation, call back' : 'Call back'} ${e.caller_name || shortId(c.id)}`.slice(0, 250),
          hs_task_body: `${c.next_action || ''}\n\n${c.handoff_note || ''}`.slice(0, 4000),
          hs_task_status: 'NOT_STARTED', hs_task_priority: urgent ? 'HIGH' : 'MEDIUM', hs_task_type: 'CALL', hs_timestamp: due,
        },
        associations: [assoc(h.contactId, ASSOC.taskToContact)],
      })).id;
    }
    // 4. note with the full detail, on the contact (and the deal)
    if (!h.noteId) {
      const links = [assoc(h.contactId, ASSOC.noteToContact)];
      if (h.dealId) links.push(assoc(h.dealId, ASSOC.noteToDeal));
      h.noteId = (await hs('POST', '/crm/v3/objects/notes', { properties: { hs_timestamp: new Date().toISOString(), hs_note_body: noteBody(c) }, associations: links })).id;
    }
    h.ok = true; delete h.error; h.syncedAt = new Date().toISOString();
  } catch (err) {
    h.ok = false; h.error = String(err.message).slice(0, 300);
  }
  return h;
}
