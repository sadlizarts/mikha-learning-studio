// Automatic study plan for school assessments (H-5 … H-1, calendar days before the first day of the assessment week).
//   H-5, H-4, H-3: one 30-question practice on the tested chapters
//   H-2:           read the weakest tested chapter again in Learn
//   H-1:           dress rehearsal — one 50-question practice
// Status is computed from what Mikha actually did today, so nothing is stored.
import { jakartaDate } from './ui.js';
import { KIND, daysUntil, practiceHash } from './schedule.js';

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
    if (!(KIND[a.kind] || {}).practice || a.is_active === false) continue;
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
