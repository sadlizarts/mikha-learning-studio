// School assessment schedule (EASE sheet) — shared by Home "Coming up", the Schedule screen and Admin › Schedule.
import { esc, subjectMeta, jakartaDate } from './ui.js';

export const KIND = {
  teacher_paced: { label: 'Common Assessment', sub: 'Teacher-paced', cls: 'tp', practice: true },
  synchronized: { label: 'Common Assessment', sub: 'Synchronized · all subjects', cls: 'sy', practice: true },
  growth: { label: 'EASE Growth', sub: 'Benchmark test', cls: 'eg', practice: false },
};
export const LOOKAHEAD_DAYS = 14;   // Home "Coming up" window
export const HEADSUP_DAYS = 3;      // banner style when the window starts this soon

const DAY = 86400000;
const toUTC = (iso) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
/** Whole days from today (Asia/Jakarta) to an ISO date; negative = past. */
export const daysUntil = (iso, today = jakartaDate()) => Math.round((toUTC(iso) - toUTC(today)) / DAY);

/** phase: 'now' (inside the window), 'soon' (≤ HEADSUP_DAYS), 'next', 'past' */
export function phase(a, today = jakartaDate()) {
  if (a.date_end < today) return 'past';
  if (a.date_start <= today) return 'now';
  return daysUntil(a.date_start, today) <= HEADSUP_DAYS ? 'soon' : 'next';
}

export function countdown(a, today = jakartaDate()) {
  const p = phase(a, today);
  if (p === 'past') return 'Done';
  if (p === 'now') { const left = daysUntil(a.date_end, today); return left === 0 ? 'Last day' : 'This week'; }
  const d = daysUntil(a.date_start, today);
  return d === 1 ? 'Tomorrow' : `In ${d} days`;
}

const fmt = (iso, opts) => new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', ...opts }).format(new Date(toUTC(iso)));
/** "Mon 19 – Fri 23 Oct" / "Mon 30 Nov – Fri 4 Dec" */
export function dateRange(a) {
  const sameMonth = a.date_start.slice(0, 7) === a.date_end.slice(0, 7);
  const s = fmt(a.date_start, sameMonth ? { weekday: 'short', day: 'numeric' } : { weekday: 'short', day: 'numeric', month: 'short' });
  const e = fmt(a.date_end, { weekday: 'short', day: 'numeric', month: 'short' });
  return a.date_start === a.date_end ? e : `${s} – ${e}`;
}
export const monthLabel = (iso) => fmt(iso, { month: 'long', year: 'numeric' });

export function upcoming(list, days = LOOKAHEAD_DAYS, today = jakartaDate()) {
  return list.filter(a => a.is_active !== false && a.date_end >= today && daysUntil(a.date_start, today) <= days)
    .sort((x, y) => x.date_start.localeCompare(y.date_start) || x.subject_name.localeCompare(y.subject_name));
}

/** Readiness from the chapters Dad linked: average recent accuracy (null when nothing practised yet). */
export function readiness(a, statBy) {
  const ids = a.chapter_ids || [];
  const st = ids.map(id => statBy[id]).filter(s => s && s.answered > 0);
  if (!ids.length || !st.length) return null;
  return { pct: Math.round(st.reduce((t, s) => t + s.accuracy_recent, 0) / st.length), practised: st.length, total: ids.length };
}

/** #/pick target: linked chapters, else the subject tab. */
export const practiceHash = (a) => a.chapter_ids?.length ? `#/pick/${a.chapter_ids.join(',')}` : `#/pick/sub:${a.subject_id}`;

/** "Wed 14 – Sun 18 Oct": the 5 calendar days before the assessment week starts. */
export function planWindow(a) {
  const s = toUTC(a.date_start);
  const iso = (t) => new Date(t).toISOString().slice(0, 10);
  return dateRange({ date_start: iso(s - 5 * DAY), date_end: iso(s - DAY) });
}

/** One assessment row (Home card + Schedule screen). */
export function assessmentRow(a, { idx = {}, statBy = {}, today = jakartaDate(), compact = false, readonly = false } = {}) {
  const k = KIND[a.kind] || KIND.teacher_paced;
  const m = subjectMeta({ name: a.subject_name });
  const p = phase(a, today);
  const chapters = (a.chapter_ids || []).map(id => idx[id]).filter(Boolean);
  const chapLine = chapters.length ? chapters.map(c => `${String(c.code).split('-').pop()} ${c.name}`).join(' · ') : (k.practice ? 'Chapters not set yet' : '');
  const r = k.practice ? readiness(a, statBy) : null;
  const meter = r ? `<div class="ready" title="Average of the last 30 answers in these chapters"><i style="--p:${r.pct}%" class="${r.pct >= 80 ? 'ok' : r.pct >= 65 ? 'mid' : 'low'}"></i></div><div class="note num">Ready ${r.pct}% · ${r.practised}/${r.total} chapters practised</div>` : '';
  const btn = !readonly && k.practice && p !== 'past' ? `<button class="btn small ${p === 'now' || p === 'soon' ? 'primary' : ''}" data-nav="${practiceHash(a)}">Practice</button>` : '';
  return `<div class="asm ${k.cls} ${p}" style="--c:${m.color}">
    <div class="when"><b class="num">${esc(countdown(a, today))}</b><span>${esc(dateRange(a))}</span></div>
    <div class="grow">
      <div class="t"><span class="sub">${esc(m.short)}</span> ${esc(a.title || k.label)}</div>
      <div class="note">${esc(k.sub)}${chapLine && !compact ? ` · ${esc(chapLine)}` : ''}</div>
      ${a.notes && !compact ? `<div class="note">${esc(a.notes)}</div>` : ''}
      ${k.practice && (p === 'next' || p === 'soon') ? `<div class="note planline">Study plan H-5 → H-1: ${esc(planWindow(a))}</div>` : ''}
      ${meter}
    </div>
    ${btn}
  </div>`;
}
