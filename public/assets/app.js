/* Aangan Enquiry Desk: one script, five pages. Each HTML file sets <body data-page="..."> and this renders the shell + that page. */
(() => {
'use strict';

// ---------- constants ----------
const DEFAULTS = { usdInr: 88, voiceInrPerMin: 5.6, numberInrPerMonth: 0, monthlyVolume: 200, unansweredShare: 48, convPct: 3, projectLakh: 11 };
const OUTCOMES = {
  forward:         { label: 'Forwarded to designer', short: 'Forwarded', icon: 'check' },
  decline:         { label: 'Declined politely',     short: 'Declined',  icon: 'minus' },
  nurture:         { label: 'Nurture',               short: 'Nurture',   icon: 'clock' },
  escalate:        { label: 'Escalated',             short: 'Escalated', icon: 'alert' },
  callback_needed: { label: 'Callback needed',       short: 'Callback',  icon: 'phone' },
};
const ORDER = ['forward', 'decline', 'nurture', 'escalate', 'callback_needed'];
const COLOR = { forward: 'var(--o-forward)', decline: 'var(--o-decline)', nurture: 'var(--o-nurture)', escalate: 'var(--o-escalate)', callback_needed: 'var(--o-callback)' };
const FLAGS = { pricing_asked: 'asked price', complaint: 'complaint', repeat_caller: 'repeat caller', proxy_caller: 'for someone else', budget_mismatch: 'budget mismatch', dropped_call: 'dropped call', after_hours: 'after hours', referral: 'referral', timeline_tight: 'tight timeline', large_project: 'large project' };
const CHECKS = [
  ['real_project', 'Real project (design and execution)'], ['service_area', 'In Pune or PCMC'], ['timeline', 'Realistic timeline'],
  ['budget', 'Budget in range'], ['decision_maker', 'Decision-maker on the call'],
];
const ICONS = {
  home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h14V10"/>',
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z"/>',
  coin: '<circle cx="12" cy="12" r="9"/><path d="M9 8h6M9 12h6M11 8c3 0 4 1.5 4 2.5S14 13 11 13l4 4"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  chev: '<path d="m9 6 6 6-6 6"/>',
  left: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
  check: '<path d="m5 12 5 5 9-10"/>',
  x: '<path d="M6 6l12 12M18 6 6 18"/>',
  minus: '<path d="M6 12h12"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  alert: '<path d="M12 4 3 20h18L12 4z"/><path d="M12 10v4M12 17h.01"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 .9-1 1.7M12 17h.01"/>',
};
const icon = (n, cls = '') => `<svg viewBox="0 0 24 24" aria-hidden="true" class="${cls}">${ICONS[n] || ''}</svg>`;

// ---------- helpers ----------
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const inr = n => '₹' + (Math.abs(n) >= 100 ? Math.round(n).toLocaleString('en-IN') : n.toFixed(2));
const lakh = n => '₹' + (n / 1e5).toFixed(1) + ' lakh';
const med = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const qs = () => new URLSearchParams(location.search);
const link = (path, params) => { const p = new URLSearchParams(); for (const [k, v] of Object.entries(params || {})) if (v) p.set(k, v); const s = p.toString(); return path + (s ? '?' + s : ''); };
const fmtDur = s => (s == null ? '—' : s >= 60 ? `${Math.floor(s / 60)}m ${String(Math.round(s % 60)).padStart(2, '0')}s` : `${Math.round(s)}s`);

let A = { ...DEFAULTS };
try { A = { ...DEFAULTS, ...JSON.parse(localStorage.getItem('aangan-assump') || '{}') }; } catch {}
const saveA = () => { try { localStorage.setItem('aangan-assump', JSON.stringify(A)); } catch {} };

// Each call gets: when label, hour of day (IST), sort key, demo/live source.
function decorate(c) {
  const demo = /^T\d\d$/.test(c.id);
  let hour = null, label = '', key = Date.parse(c.receivedAt) || 0;
  if (demo) {
    const parts = (c.header || '').split(' - ');
    const date = (parts[2] || '').trim(), t = (parts[3] || '').match(/(\d{1,2}):(\d{2})\s*(am|pm)/i);
    if (t) { hour = Number(t[1]) % 12 + (/pm/i.test(t[3]) ? 12 : 0); }
    const dm = date.match(/(\d{1,2})\s+([A-Za-z]+)/);
    if (dm && t) key = Date.UTC(2026, Math.max(0, MONTHS.indexOf(dm[2].toLowerCase())), Number(dm[1]), hour, Number(t[2]));
    label = `${date}${t ? ' · ' + t[1] + ':' + t[2] + ' ' + t[3].toLowerCase() : ''}`;
  } else {
    const d = new Date(key + 5.5 * 3600e3);
    hour = d.getUTCHours();
    const h12 = hour % 12 || 12;
    label = `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()][0].toUpperCase() + MONTHS[d.getUTCMonth()].slice(1)} · ${h12}:${String(d.getUTCMinutes()).padStart(2, '0')} ${hour >= 12 ? 'pm' : 'am'}`;
  }
  const after = c.flags?.includes('after_hours') || (hour != null && (hour < 10 || hour >= 19));
  return { ...c, demo, hour, whenLabel: label, sortKey: key, after };
}
const who = c => {
  const e = c.extracted || {};
  const bits = [e.project_type, e.location, e.size_sqft ? e.size_sqft + ' sq ft' : null].filter(Boolean);
  return { name: e.caller_name || '', detail: bits.join(' · ') || c.reasons?.[0] || '' };
};
const displayId = c => (c.demo ? c.id : '#' + (c.id.split('-').pop() || c.id).slice(0, 4).toUpperCase());
const outTag = (k, short) => `<span class="tag t-${k}"><i></i>${icon(OUTCOMES[k].icon)}${esc(short ? OUTCOMES[k].short : OUTCOMES[k].label)}</span>`;

// ---------- data ----------
let CALLS = [];
async function loadData() {
  const res = await fetch('/api/data', { cache: 'no-store' });
  if (res.status === 401) throw new Error('auth');
  if (!res.ok) throw new Error('http ' + res.status);
  CALLS = (await res.json()).calls.map(decorate).sort((a, b) => b.sortKey - a.sortKey);
}

// ---------- shell ----------
const NAV = [['overview', '/', 'Overview', 'home'], ['calls', '/calls', 'Calls', 'phone'], ['costs', '/costs', 'Costs & value', 'coin'], ['how', '/how-it-works', 'How it works', 'info']];
function shell(page) {
  const active = page === 'call' ? 'calls' : page;
  const nav = NAV.map(([k, href, label, ic]) => `<a href="${href}" ${k === active ? 'aria-current="page"' : ''}>${icon(ic)}${label}</a>`).join('');
  const brand = `<a class="brand" href="/"><div class="logo">A</div><div><b>Aangan Studio</b><span>Enquiry Desk</span></div></a>`;
  $('#app').innerHTML = `
    <div class="shell">
      <aside class="side">${brand}<nav class="nav" aria-label="Main">${nav}</nav>
        <div class="side-foot"><span class="live"><i class="pulse"></i><span id="live-note">Live</span></span>
        <span>Phone enquiries, answered and qualified by AI.</span>
        <a href="https://github.com/sid1935/aangan-enquiry-desk" target="_blank" rel="noopener">View the code on GitHub</a></div></aside>
      <div class="main"><header class="topbar">${brand}<nav class="nav" aria-label="Main">${nav}</nav></header>
        <main class="view" id="view"><div class="skeleton"></div></main></div>
    </div>`;
}

// ---------- OVERVIEW ----------
function overview() {
  const n = CALLS.length, by = k => CALLS.filter(c => c.decision === k);
  const fwd = by('forward'), after = CALLS.filter(c => c.after);
  const times = CALLS.map(c => c.processingSec).filter(x => x != null), mt = med(times);
  const sent = CALLS.filter(c => c.telegram === 'sent').length;
  const attn = CALLS.filter(c => c.decision === 'escalate' || c.decision === 'callback_needed');
  const pct = v => (n ? Math.round(v / n * 100) : 0);

  const kpi = (href, v, l, note) => `<a class="card kpi" href="${href}"><span class="go">${icon('arrow')}</span><div class="v">${v}</div><div class="l">${l}</div><div class="n">${note}</div></a>`;
  const hoursData = Array.from({ length: 24 }, (_, h) => CALLS.filter(c => c.hour === h).length);
  const maxH = Math.max(1, ...hoursData);
  const fmtH = h => `${h % 12 || 12}${h >= 12 ? 'pm' : 'am'}`;

  $('#view').innerHTML = `
    <div class="page-head"><div><h1>Overview</h1><p>Every phone enquiry gets an outcome. Tap a number to see the calls behind it.</p></div></div>
    <div class="grid kpis">
      ${kpi('/calls', n, 'Calls handled', 'every call gets an outcome')}
      ${kpi(link('/calls', { outcome: 'forward' }), fwd.length, 'Leads sent to designers', `${pct(fwd.length)}% of calls, each with a full note`)}
      ${kpi(link('/calls', { hours: 'after' }), after.length, 'Calls outside 10am–7pm', 'the front desk was off; the system was not')}
      <div class="card kpi"><div class="v">${mt != null ? mt.toFixed(1) + ' s' : '—'}</div><div class="l">Call end to hand-off</div><div class="n">median · ${sent} Telegram notes delivered</div></div>
    </div>

    <div class="section"><h2>Needs a human now</h2>
      ${attn.length ? `<div class="grid">${attn.map(c => `<a class="card callout ${c.decision === 'escalate' ? 'esc' : 'cb'}" href="${link('/call', { id: c.id })}" style="display:block">
          <div style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:4px 10px;align-items:center;margin-bottom:6px"><span style="display:flex;gap:10px;align-items:center"><b>${esc(displayId(c))}</b>${outTag(c.decision)}</span><span class="when-r">${esc(c.whenLabel)} ${icon('chev')}</span></div>
          <div class="note">${esc(c.handoff_note)}</div></a>`).join('')}</div>` : '<div class="card empty">Nothing waiting. All clear.</div>'}
    </div>

    <div class="section grid two">
      <div class="card"><h2>How calls ended</h2><p class="sub">Tap a segment or a row to open those calls.</p>
        <div class="stack" role="img" aria-label="Outcome split">${ORDER.map(k => by(k).length ? `<a href="${link('/calls', { outcome: k })}" style="flex:${by(k).length};background:${COLOR[k]}" title="${OUTCOMES[k].label}: ${by(k).length}"></a>` : '').join('')}</div>
        <div class="legend">${ORDER.map(k => `<a href="${link('/calls', { outcome: k })}"><i style="background:${COLOR[k]}"></i><span class="nm">${OUTCOMES[k].label}</span><b>${by(k).length}</b><span class="pc">${pct(by(k).length)}%</span></a>`).join('')}</div>
      </div>
      <div class="card"><h2>When calls arrive</h2><p class="sub">Calls by hour of day. The shaded band is desk hours, 10am to 7pm.</p>
        <div class="hours" role="img" aria-label="Calls by hour of day"><div class="band"></div>
          ${hoursData.map((v, h) => `<div class="hcol ${h < 10 || h >= 19 ? 'after' : ''}" tabindex="0" aria-label="${fmtH(h)}: ${v} calls"><span style="height:${v ? Math.max(6, v / maxH * 100) : 0}%"></span><div class="tip">${fmtH(h)} · ${v} ${v === 1 ? 'call' : 'calls'}</div></div>`).join('')}
        </div>
        <div class="haxis">${hoursData.map((_, h) => `<span class="${h % 6 === 0 ? 'k' : ''}">${h % 6 === 0 ? fmtH(h) : ''}</span>`).join('')}</div>
        <div class="key"><span><i style="background:var(--bar-office)"></i>Desk hours</span><span><i style="background:var(--bar-after)"></i>Outside desk hours</span></div>
        <details class="tbl"><summary>View as table</summary><table><tr><th>Hour</th><th>Calls</th></tr>${hoursData.map((v, h) => v ? `<tr><td>${fmtH(h)}</td><td>${v}</td></tr>` : '').join('')}</table></details>
      </div>
    </div>

    <div class="section"><h2>Latest calls</h2>
      <div class="card recent" style="padding:6px 6px 0">${CALLS.slice(0, 5).map(c => rowHTML(c, true)).join('') || '<div class="empty">No calls yet.</div>'}
        <a class="callrow" style="grid-template-columns:1fr;justify-items:center;font-weight:600;color:var(--brand)" href="/calls">See all ${n} calls</a></div>
    </div>`;
}

// ---------- shared row ----------
function rowHTML(c, compact) {
  const w = who(c);
  const fl = (c.flags || []).filter(x => x !== 'after_hours').map(x => `<span class="flag">${esc(FLAGS[x] || x)}</span>`).join('');
  const hand = c.telegram === 'sent' ? 'Telegram ✓' : c.telegram === 'not_needed' ? 'Logged only' : esc(c.telegram || '');
  const src = c.demo ? '' : '<span class="src live">Live</span>';
  const mob = `<div class="mob"><b>${esc(displayId(c))}</b>${outTag(c.decision, true)}<span class="when">${esc(c.whenLabel)}</span>${src}</div>`;
  const whoHTML = `<div class="who">${w.name ? `<b>${esc(w.name)}</b>` : ''}<div>${esc(w.detail)}</div></div>`;
  return `<a class="callrow" href="${link('/call', { id: c.id })}">
    <div class="id">${esc(displayId(c))}${src ? '<br>' + src : ''}</div>
    ${compact ? '' : `<div class="when">${esc(c.whenLabel)}${c.after ? '<br><span class="flag">after hours</span>' : ''}</div>`}
    <div class="tagcol">${outTag(c.decision)}</div>
    ${whoHTML}
    ${compact ? '' : `<div class="flagcol">${fl}</div><div class="hand">${hand}</div>`}
    ${mob}
    <div class="chev">${icon('chev')}</div></a>`;
}

// ---------- CALLS ----------
const F = { outcome: 'all', hours: 'all', q: '' };
function calls() {
  const p = qs();
  F.outcome = OUTCOMES[p.get('outcome')] ? p.get('outcome') : 'all';
  F.hours = ['after', 'office'].includes(p.get('hours')) ? p.get('hours') : 'all';
  F.q = p.get('q') || '';

  const chip = (g, v, l) => `<button class="chip" data-g="${g}" data-v="${v}" aria-pressed="${F[g] === v}">${l}</button>`;
  $('#view').innerHTML = `
    <div class="page-head"><div><h1>Calls</h1><p>Every enquiry, newest first. Open one to read the handoff note and see how it was decided.</p></div></div>
    <div class="toolbar">
      <div class="chips" id="c-out"><span class="lab">Outcome</span>${chip('outcome', 'all', 'All')}${ORDER.map(k => chip('outcome', k, OUTCOMES[k].short)).join('')}</div>
      <div class="chips" id="c-hrs"><span class="lab">Time</span>${chip('hours', 'all', 'Any time')}${chip('hours', 'office', '10am–7pm')}${chip('hours', 'after', 'Outside 10–7')}</div>
      <label class="search">${icon('search')}<input id="q" type="search" placeholder="Search name, place, call id" value="${esc(F.q)}" aria-label="Search calls"></label>
    </div>
    <div id="list"></div>`;
  $('#view').addEventListener('click', e => {
    const b = e.target.closest('.chip'); if (!b) return;
    F[b.dataset.g] = b.dataset.v;
    document.querySelectorAll(`.chip[data-g="${b.dataset.g}"]`).forEach(x => x.setAttribute('aria-pressed', String(x === b)));
    syncUrl(); drawList();
  });
  $('#q').addEventListener('input', e => { F.q = e.target.value; syncUrl(); drawList(); });
  drawList();
}
function syncUrl() {
  history.replaceState(null, '', link('/calls', { outcome: F.outcome === 'all' ? '' : F.outcome, hours: F.hours === 'all' ? '' : F.hours, q: F.q }));
}
function filtered() {
  const q = F.q.trim().toLowerCase();
  return CALLS.filter(c => (F.outcome === 'all' || c.decision === F.outcome)
    && (F.hours === 'all' || (F.hours === 'after' ? c.after : !c.after))
    && (!q || [c.id, c.extracted?.caller_name, c.extracted?.location, c.extracted?.project_type, c.handoff_note].join(' ').toLowerCase().includes(q)));
}
function drawList() {
  const list = filtered();
  $('#list').innerHTML = `<p class="count">${list.length} of ${CALLS.length} calls</p>
    <div class="card" style="padding:6px 6px 0"><div class="rows">
      <div class="callrow head"><div>Call</div><div>When</div><div>Outcome</div><div>Caller and project</div><div class="flagcol">Flags</div><div class="hand">Hand-off</div><div></div></div>
      ${list.length ? list.map(c => rowHTML(c)).join('') : '<div class="empty">No calls match these filters.</div>'}
    </div></div>`;
}

// ---------- CALL DETAIL ----------
function call() {
  const id = qs().get('id');
  const i = CALLS.findIndex(c => c.id === id);
  if (i < 0) { $('#view').innerHTML = `<div class="card msg">We couldn't find call <b>${esc(id || '')}</b>.<br><br><a class="ext" href="/calls">${icon('left')} Back to all calls</a></div>`; return; }
  const c = CALLS[i], e = c.extracted || {}, newer = CALLS[i - 1], older = CALLS[i + 1];
  document.title = `${displayId(c)} · ${OUTCOMES[c.decision].short} · Aangan Enquiry Desk`;
  const nil = v => (v == null || v === '' ? '<dd class="nil">Not stated</dd>' : `<dd>${esc(v)}</dd>`);
  const kv = (k, v) => `<dt>${k}</dt>${nil(v)}`;
  const pill = v => v === 'pass' ? `<span class="pill p-pass">${icon('check')}Pass</span>` : v === 'fail' ? `<span class="pill p-fail">${icon('x')}Fail</span>` : `<span class="pill p-unclear">${icon('help')}Unclear</span>`;
  const inrCost = ((c.usage?.costUsd || 0) * A.usdInr) + ((c.callDurationSec || 0) / 60) * A.voiceInrPerMin;
  const delivery = c.telegram === 'sent' ? 'Sent to Telegram' : c.telegram === 'not_needed' ? 'Logged only. No designer ping needed.' : c.telegram === 'failed' ? 'Telegram failed' : esc(c.telegram || '—');
  const nav = (x, dir) => x ? `<a href="${link('/call', { id: x.id })}">${dir === 'n' ? '' : icon('left')}<span><small>${dir === 'n' ? 'Newer' : 'Older'}</small>${esc(displayId(x))} · ${esc(who(x).name || OUTCOMES[x.decision].short)}</span>${dir === 'n' ? icon('chev') : ''}</a>` : '<span></span>';

  $('#view').innerHTML = `
    <div class="crumb"><a href="/calls">Calls</a> ${icon('chev')} <span>${esc(displayId(c))}</span></div>
    <div class="hero"><h1>${esc(displayId(c))}${who(c).name ? ' · ' + esc(who(c).name) : ''}</h1>${outTag(c.decision)}${c.demo ? '' : '<span class="src live">Live call</span>'}${c.urgency === 'high' ? '<span class="pill p-fail">High urgency</span>' : ''}</div>
    <p class="meta"><span>${icon('clock')} ${esc(c.whenLabel)}${c.after ? ' (outside desk hours)' : ''}</span><span>${icon('phone')} ${fmtDur(c.callDurationSec)} call</span><span>${icon('arrow')} Note delivered in ${c.processingSec != null ? c.processingSec + ' s' : '—'}</span></p>

    <div class="detail">
      <div class="stackcol">
        <div class="card"><div class="lbl">Handoff note</div><div class="callout ${c.decision === 'escalate' ? 'esc' : c.decision === 'callback_needed' ? 'cb' : ''}"><div class="note">${esc(c.handoff_note)}</div></div>
          <p class="lbl" style="margin-top:16px">Suggested next step</p><div>${esc(c.next_action)}</div></div>
        <div class="card"><div class="lbl">What the caller was told</div><div class="note">${esc(c.reply_to_caller)}</div></div>
        <div class="card"><div class="lbl">Why it was decided this way</div>${(c.reasons || []).length ? `<ul style="margin:6px 0 0;padding-left:18px">${c.reasons.map(r => `<li>${esc(r)}</li>`).join('')}</ul>` : '<span class="nil">No reasons recorded.</span>'}</div>
      </div>
      <div class="stackcol">
        <div class="card"><div class="lbl">Caller details</div><dl class="kv">
          ${kv('Name', e.caller_name)}${kv('Phone', e.phone)}${kv('Location', e.location)}${kv('Project', e.project_type)}${kv('Size', e.size_sqft ? e.size_sqft + ' sq ft' : null)}
          ${kv('Timeline', e.timeline)}${kv('Owner', e.owner_status)}${kv('Budget said', e.budget_mentioned)}${kv('Heard of us', e.referral_source)}${kv('Preferred slots', e.preferred_slots)}</dl></div>
        <div class="card"><div class="lbl">The five checks</div><div class="checks">${CHECKS.map(([k, l]) => `<div class="check"><span>${l}</span>${pill((c.criteria || {})[k])}</div>`).join('')}</div>
          ${(c.flags || []).length ? `<div style="margin-top:12px">${c.flags.map(f => `<span class="flag">${esc(FLAGS[f] || f)}</span>`).join('')}</div>` : ''}</div>
        <div class="card"><div class="lbl">Delivery and cost</div><dl class="kv">
          <dt>Hand-off</dt><dd>${delivery}</dd><dt>Voice minutes</dt><dd>${fmtDur(c.callDurationSec)}</dd>
          <dt>AI tokens</dt><dd>${((c.usage?.tokensIn || 0) + (c.usage?.tokensOut || 0)).toLocaleString('en-IN')}</dd><dt>Est. cost</dt><dd>${inr(inrCost)}</dd></dl></div>
      </div>
    </div>
    <div class="pager">${nav(older, 'o')}${nav(newer, 'n')}</div>`;
}

// ---------- COSTS ----------
function costs() {
  const n = CALLS.length || 1, fwd = CALLS.filter(c => c.decision === 'forward').length;
  const render = () => {
    const llmInr = CALLS.reduce((s, c) => s + (c.usage?.costUsd || 0), 0) * A.usdInr;
    const mins = CALLS.reduce((s, c) => s + (c.callDurationSec || 0), 0) / 60, voiceInr = mins * A.voiceInrPerMin;
    const perCall = (llmInr + voiceInr) / n, monthly = perCall * A.monthlyVolume + A.numberInrPerMonth;
    const recovered = A.monthlyVolume * A.unansweredShare / 100, value = recovered * (A.convPct / 100) * A.projectLakh * 1e5;
    const be = monthly / (A.projectLakh * 1e5);
    const tot = llmInr + voiceInr || 1;
    $('#costbody').innerHTML = `
      <div class="grid kpis kpis3">
        <div class="card kpi"><div class="v">${inr(perCall)}</div><div class="l">Cost per enquiry</div><div class="n">voice and AI together</div></div>
        <div class="card kpi"><div class="v">${fwd ? inr((llmInr + voiceInr) / fwd) : '—'}</div><div class="l">Cost per lead sent to a designer</div><div class="n">all calls' cost spread over ${fwd} leads</div></div>
        <div class="card kpi"><div class="v">${inr(monthly)}</div><div class="l">Projected per month</div><div class="n">at ${A.monthlyVolume} enquiries</div></div>
      </div>
      <div class="section grid two-eq">
        <div class="card"><h2>What the tool costs</h2><p class="sub">Across the ${CALLS.length} calls in the log.</p>
          <div class="share" role="img" aria-label="Share of cost"><span style="flex:${voiceInr || 0.0001};background:var(--brand)" title="Voice"></span><span style="flex:${llmInr || 0.0001};background:var(--bar-office)" title="AI"></span></div>
          <div class="rowkv"><span><i class="dot" style="display:inline-block;width:9px;height:9px;border-radius:50%;background:var(--brand);margin-right:8px"></i>Voice agent · ${mins.toFixed(1)} min at ${inr(A.voiceInrPerMin)}/min</span><b>${A.voiceInrPerMin ? inr(voiceInr) : 'rate not set'} · ${Math.round(voiceInr / tot * 100)}%</b></div>
          <div class="rowkv"><span><i class="dot" style="display:inline-block;width:9px;height:9px;border-radius:50%;background:var(--bar-office);margin-right:8px"></i>AI qualification (Gemini)</span><b>${inr(llmInr)} · ${Math.round(llmInr / tot * 100)}%</b></div>
          <div class="rowkv"><span>Phone number (monthly)</span><b>${inr(A.numberInrPerMonth)}</b></div>
          <div class="rowkv total"><span>Total for these calls</span><b>${inr(llmInr + voiceInr)}</b></div>
          <p class="fine">${A.voiceInrPerMin ? '' : 'Voice cost is not included yet, so totals are a floor. '}Gemini cost uses estimated token prices. The September calls' lengths are how long the human front desk spent, so the voice agent may run shorter or longer.</p></div>
        <div class="card"><h2>Assumptions</h2><p class="sub">Edit these. Saved in this browser only.</p><div id="assump">
          ${[['usdInr', 'USD to INR'], ['voiceInrPerMin', 'Voice cost, ₹ per minute'], ['numberInrPerMonth', 'Phone number, ₹ per month'], ['monthlyVolume', 'Enquiries per month'], ['unansweredShare', 'Unanswered in 48 hrs, %'], ['convPct', 'Conversion of those, % (placeholder)'], ['projectLakh', 'Average project value, lakh']]
            .map(([k, l]) => `<label class="fld">${l}<input type="number" step="any" min="0" data-k="${k}" value="${A[k]}"></label>`).join('')}</div></div>
      </div>
      <div class="section card"><h2>Is it worth it?</h2><p class="sub">The break-even line needs only the project value, not a conversion guess.</p>
        <div class="grid two-eq" style="align-items:center"><div>
          <div class="rowkv"><span>Enquiries a month with no reply in 48 hrs (${A.unansweredShare}% of ${A.monthlyVolume})</span><b>${Math.round(recovered)}</b></div>
          <div class="rowkv"><span>If answered, and ${A.convPct}% become projects of ${A.projectLakh} lakh</span><b>${lakh(value)} a month</b></div>
          <div class="rowkv"><span>Monthly running cost</span><b>${inr(monthly)}</b></div></div>
          <div><div class="lbl">Projects needed a month to cover the cost</div><div class="big">${be < 0.01 ? 'under 0.01' : be.toFixed(2)}</div><p class="fine">The ${A.convPct}% conversion is a placeholder: replace it with Nikhil's real rate. The case says a reply within an hour converts at 4× a next-day reply.</p></div></div>
      </div>`;
  };
  $('#view').innerHTML = `<div class="page-head"><div><h1>Costs & value</h1><p>What the tool costs to run, and whether it earns its keep. Nikhil never has to pull these numbers by hand again.</p></div></div><div id="costbody"></div>`;
  render();
  $('#view').addEventListener('input', e => { const k = e.target.dataset?.k; if (!k) return; A[k] = Number(e.target.value) || 0; saveA(); render(); });
}

// ---------- HOW IT WORKS ----------
function how() {
  $('#view').innerHTML = `
    <div class="page-head"><div><h1>How it works</h1><p>From a ringing phone to a designer's pocket in a few seconds, with a human always deciding what happens next.</p></div></div>
    <div class="flow">
      <div class="step"><b>Caller rings</b><p>A Vaani voice agent picks up day or night, in under five minutes, and asks one question at a time.</p></div>
      <div class="step"><b>Call ends</b><p>Vaani sends the transcript to our webhook the moment its post-processing finishes.</p></div>
      <div class="step"><b>AI qualifies</b><p>Gemini applies Nikhil's five-point rubric and the studio's service rules. It never has the price list.</p></div>
      <div class="step"><b>Designer pinged</b><p>Leads, escalations and missed calls arrive on Telegram with the details already collected.</p></div>
      <div class="step"><b>Logged here</b><p>Every call lands on this dashboard with its outcome, cost and the reasoning behind it.</p></div>
    </div>
    <div class="section grid two-eq">
      <div class="card prose"><h2>What we chose not to build</h2><p><b>No pricing on calls.</b> Nikhil asked for the per-square-foot price to be quoted. The internal guide says "indicative only, varies by site", so a wrong number on an 8–14 lakh project becomes a commitment the studio can't back.</p><p>The agent never sees the price file, never gives a figure, and says one approved line instead. Asking for a price never disqualifies a caller.</p></div>
      <div class="card prose"><h2>Why Telegram, not email</h2><p>Designers are on site and on their phones. A push notification is seen in seconds, and speed is the whole premise: a reply within an hour converts at four times the rate of a next-day reply.</p><p>Email is slower to be noticed. It can be added later as a copy for the record.</p></div>
    </div>
    <div class="section grid two-eq">
      <div class="card prose"><h2>The five checks</h2><p><b>Real project</b>, <b>in Pune or PCMC</b>, <b>realistic timeline</b>, <b>budget in range</b>, and <b>a decision-maker on the call</b>. Unclear budget or decision-maker is noted, never a reason to turn someone away. Two failures means a graceful decline.</p></div>
      <div class="card prose"><h2>Adding WhatsApp and the web form</h2><p>Only the trigger and the input change. Their messages flow into the same qualification step as a transcript, and everything after it, from the Telegram note to this dashboard, is shared. They are out of scope for this build.</p><p><a class="ext" href="https://github.com/sid1935/aangan-enquiry-desk" target="_blank" rel="noopener">Read the code ${icon('arrow')}</a></p></div>
    </div>`;
}

// ---------- boot ----------
const PAGES = { overview, calls, call, costs, how };
async function boot() {
  const page = document.body.dataset.page;
  shell(page);
  if (page === 'how') { how(); return; }
  const draw = () => { try { PAGES[page](); } catch (e) { console.error(e); $('#view').innerHTML = '<div class="card msg">Something went wrong drawing this page.</div>'; } };
  try { await loadData(); }
  catch (e) {
    $('#view').innerHTML = `<div class="card msg">${e.message === 'auth' ? 'This dashboard asks for a login. Reload the page and enter it when prompted.' : 'We could not load the calls just now. Please try again in a moment.'}</div>`;
    return;
  }
  draw();
  const note = $('#live-note'); if (note) note.textContent = `Live · ${CALLS.length} calls`;
  // quiet refresh: update data and the list/overview, without redrawing form controls the user is typing in
  if (page === 'overview' || page === 'calls') setInterval(async () => {
    try { await loadData(); if (page === 'overview') overview(); else if (document.activeElement?.id !== 'q') drawList(); if (note) note.textContent = `Live · ${CALLS.length} calls`; } catch {}
  }, 20000);
}
boot();
})();
