// Automatic study plan for school assessments (H-5 … H-1, calendar days before the first day of the assessment week).
//   H-5, H-4, H-3: one 30-question practice on the tested chapters
//   H-2:           read the weakest tested chapter again in Learn
//   H-1:           dress rehearsal — one 50-question practice
// Status is computed from what Mikha actually did today, so nothing is stored.
import { jakartaDate } from './ui.js';
import { KIND, daysUntil, practiceHash, metaOf } from './schedule.js';

export const PLAN_DAYS = 5;

/** Chapters an assessment covers: the ones Dad linked, else every chapter of that subject that has questions. */
export function targetChapters(a, cat) {
  if (a.chapter_ids?.length) return a.chapter_ids;
  return cat.chapters.filter(c => c.subject_id === a.subject_id && (c.distinct_items || 0) > 0).map(c => c.chapter_id);
}

const shortOf = (a) => ({ 'Mathematics': 'Math', 'Bahasa Indonesia': 'B. Indonesia', 'Pendidikan Agama': 'Agama', 'Pendidikan Pancasila': 'Pancasila' }[a.subject_name] || a.subject_name);
const whenTxt = (d) => d === 1 ? 'tomorrow' : `in ${d} days`;

/**
 * @param asms   active assessments (loadAssessments)
 * @param ctx    { cat, idx, attempts (completed, newest first), reads ({chapterId: {last_read_at}}), lessons ({chapterId: meta}), today }
 * @returns [{ id, asm, daysLeft, step, title, detail, done, action:{label, hash}|null }]
 */
export function studyPlan(asms, { cat, idx, attempts = [], reads = {}, lessons = {}, today = jakartaDate() }) {
  const out = [];
  const todays = attempts.filter(t => jakartaDate(t.finished_at) === today);
  for (const a of asms) {
    // only Common Assessments get the automatic H-5 plan; final exams use the hand-made exam plan (kind 'prep')
    if (!['teacher_paced', 'synchronized'].includes(a.kind) || a.is_active === false) continue;
    const d = daysUntil(a.date_start, today);
    if (d < 1 || d > PLAN_DAYS) continue;
    const ids = targetChapters(a, cat);
    if (!ids.length) continue;
    const set = new Set(ids);
    const avail = ids.reduce((t, id) => t + (cat.chapters.find(c => c.chapter_id === id)?.distinct_items || 0), 0);
    const touches = (t) => (t.chapter_ids || []).some(id => set.has(id));
    const what = `${shortOf(a)} ${a.title || KIND[a.kind].label} ${whenTxt(d)}`;
    const codes = a.chapter_ids?.length ? ids.map(id => String(idx[id]?.code || '').split('-').pop()).filter(Boolean).join(' · ') : `all ${shortOf(a)} chapters`;
    const base = { id: `${a.id}:${d}`, asm: a, daysLeft: d };
    if (d >= 3) {
      const done = todays.some(t => touches(t) && t.total_questions >= Math.min(30, avail));
      out.push({ ...base, step: 'practice', title: 'Practice 30 questions', detail: `${what} · ${codes}`, done,
        action: { label: 'Practice', hash: practiceHash(a) } });
    } else if (d === 2) {
      // weakest practised chapter; if none practised yet, the first tested chapter that has a lesson
      const st = ids.map(id => ({ id, s: cat.statBy[id] })).filter(x => x.s && x.s.answered > 0).sort((x, y) => x.s.accuracy_recent - y.s.accuracy_recent);
      const pickId = (st.find(x => lessons[x.id]) || st[0] || { id: ids.find(id => lessons[id]) || ids[0] }).id;
      const c = idx[pickId];
      const acc = cat.statBy[pickId]?.answered ? ` (now ${cat.statBy[pickId].accuracy_recent}%)` : '';
      const r = reads[pickId];
      const done = !!(r?.last_read_at && jakartaDate(r.last_read_at) === today);
      out.push({ ...base, step: 'read', title: `Read again: ${c ? `${String(c.code).split('-').pop()} ${c.name}` : 'the weakest chapter'}`, detail: `Weakest chapter for ${what}${acc}`, done,
        action: lessons[pickId] ? { label: 'Read', hash: `#/lesson/${pickId}` } : { label: 'Practice', hash: `#/pick/${pickId}` } });
    } else {
      const need = Math.min(50, avail);
      const done = todays.some(t => touches(t) && t.total_questions >= need);
      out.push({ ...base, step: 'rehearsal', title: `Dress rehearsal: ${need} questions`, detail: `${what} · ${codes}`, done,
        action: { label: 'Start', hash: `${practiceHash(a)}~50` } });
    }
  }
  return out.sort((x, y) => x.daysLeft - y.daysLeft);
}

/** The whole 5-day plan for one assessment (for the Schedule screen). */
export function planDays(a) {
  const steps = ['Practice 30', 'Practice 30', 'Practice 30', 'Read weakest', 'Rehearsal 50'];
  const start = Date.UTC(+a.date_start.slice(0, 4), +a.date_start.slice(5, 7) - 1, +a.date_start.slice(8, 10));
  return steps.map((s, i) => {
    const dt = new Date(start - (PLAN_DAYS - i) * 86400000);
    return { day: `H-${PLAN_DAYS - i}`, date: dt.toISOString().slice(0, 10), step: s };
  });
}

/* ---------------- Final exam plan (v3.6.0) ----------------
 * Dad's day-by-day plan before the semester final exams is stored as assessments rows of kind 'prep'
 * (one row per task: date, subject, chapters, task = practice | rehearsal | read | light, questions).
 * Chapter choice is live: "practice" opens the 2 weakest exam chapters of the moment (never practised first),
 * "rehearsal" opens all exam chapters (50), "read" opens the weakest chapter that has a lesson.
 * Done = a completed practice that day on those chapters with ≥ the planned number of questions, or a lesson read that day. */

/** exam chapters, weakest first (never practised → 0 %) */
export function weakestFirst(ids, statBy) {
  return [...ids].sort((x, y) => {
    const a = statBy[x], b = statBy[y];
    const ax = a?.answered ? a.accuracy_recent : -1, bx = b?.answered ? b.accuracy_recent : -1;
    return ax - bx;
  });
}
const accTxt = (id, statBy) => statBy[id]?.answered ? `${statBy[id].accuracy_recent}%` : 'new';
const codeOf = (id, idx) => String(idx[id]?.code || '').split('-').pop();

/** one plan task → display item for a given day */
export function planTask(a, { cat, idx, attempts = [], reads = {}, lessons = {}, finals = [], day }) {
  const ids = (a.chapter_ids || []).filter(id => idx[id]);
  const short = metaOf(a).short;
  const n = a.questions || (a.task === 'rehearsal' ? 50 : 30);
  const set = new Set(ids);
  const dayAttempts = attempts.filter(t => jakartaDate(t.finished_at) === day && (t.chapter_ids || []).some(c => set.has(c)));
  const fin = finals.find(f => f.subject_id === a.subject_id && f.date_start >= day);
  const daysLeft = fin ? daysUntil(fin.date_start, day) : null;
  const base = { id: a.id, asm: a, task: a.task || 'practice', subject: short, color: metaOf(a).color, daysLeft, note: a.notes || '' };
  if (a.task === 'read') {
    const order = weakestFirst(ids, cat.statBy);
    const pickId = order.find(id => lessons[id]) || order[0];
    const done = ids.some(id => reads[id]?.last_read_at && jakartaDate(reads[id].last_read_at) >= day);
    return { ...base, title: `${short} · Read again: ${pickId ? `${codeOf(pickId, idx)} ${idx[pickId]?.name || ''}` : 'weakest chapter'}`,
      detail: pickId ? `Weakest exam chapter now (${accTxt(pickId, cat.statBy)}) · Boss Intel / lesson` : '', done,
      action: pickId ? (lessons[pickId] ? { label: 'Read', hash: `#/lesson/${pickId}` } : { label: 'Practice', hash: `#/pick/${pickId}~30` }) : null };
  }
  const avail = ids.reduce((t, id) => t + (cat.chapters.find(c => c.chapter_id === id)?.distinct_items || 0), 0);
  const need = Math.min(n, avail || n);
  const done = dayAttempts.some(t => t.total_questions >= need);
  if (a.task === 'rehearsal') {
    return { ...base, title: `${short} · Dress rehearsal ${need}`, detail: `All exam chapters: ${ids.map(id => codeOf(id, idx)).join(' · ')}`, done,
      action: { label: 'Start', hash: `#/pick/${ids.join(',')}~${need === 50 ? 50 : 30}` } };
  }
  const weak = weakestFirst(ids, cat.statBy).slice(0, ids.length > 2 ? 2 : ids.length);
  return { ...base, title: `${short} · Practice ${need}${a.task === 'light' ? ' (light day)' : ''}`,
    detail: `Weakest now: ${weak.map(id => `${codeOf(id, idx)} ${accTxt(id, cat.statBy)}`).join(' · ')}`, done,
    action: { label: 'Practice', hash: `#/pick/${weak.join(',')}~30` } };
}

/** all plan tasks for one day (default today) */
export function examPlan(asms, ctx) {
  const day = ctx.day || jakartaDate();
  const finals = asms.filter(a => a.kind === 'final' && a.is_active !== false);
  return asms.filter(a => a.kind === 'prep' && a.is_active !== false && a.date_start === day)
    .sort((x, y) => (x.week || 0) - (y.week || 0) || (x.subject_name || '').localeCompare(y.subject_name || ''))   // prep rows: week = slot order within the day
    .map(a => planTask(a, { ...ctx, finals, day }));
}

/** the whole plan grouped by day: [{ day, items, exams: finals/reminders that day }] */
export function examPlanDays(asms, ctx) {
  const prepDays = asms.filter(a => a.kind === 'prep' && a.is_active !== false).map(a => a.date_start);
  if (!prepDays.length) return [];
  const extra = asms.filter(a => ['final', 'reminder'].includes(a.kind) && a.is_active !== false);
  const first = prepDays.reduce((m, d) => d < m ? d : m);
  // exam days with no practice left (e.g. the last exam) still get a row, from the first plan day on
  const days = [...new Set([...prepDays, ...extra.filter(e => e.kind === 'final' && e.date_start >= first).map(e => e.date_start)])].sort();
  return days.map(day => ({ day, items: examPlan(asms, { ...ctx, day }), exams: extra.filter(e => e.date_start === day) }));
}
