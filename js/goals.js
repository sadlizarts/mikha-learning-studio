// Goal status rules (PRD FR-61). Shared by the student Home card and the admin Goals tab.
import { jakartaDate } from './ui.js';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const dayName = (i) => DAYS[i];

/** Day of week (0=Sun) in Asia/Jakarta. */
export function jakartaDow(d = new Date()) {
  const wd = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Jakarta', weekday: 'short' }).format(d);
  return DAYS.indexOf(wd);
}

/**
 * @param goal row from public.goals
 * @param ctx { sessionsToday:number, statBy:{[chapterId]:{answered, accuracy_recent}}, chapterName:(id)=>string, minAnswered:number }
 * @returns {status:'done'|'pending'|'overdue'|'hidden', title:string, detail:string}
 */
export function goalStatus(goal, ctx) {
  if (goal.type === 'daily') {
    const days = goal.days_of_week?.length ? goal.days_of_week : [1, 2, 3, 4, 5];
    const n = goal.sessions_per_day || 1;
    const title = `${n} practice${n > 1 ? 's' : ''} today`;
    if (!days.includes(jakartaDow())) return { status: 'hidden', title, detail: 'Not a practice day' };
    const done = ctx.sessionsToday >= n;
    return { status: done ? 'done' : 'pending', title, detail: `${Math.min(ctx.sessionsToday, n)}/${n} done` };
  }
  const st = ctx.statBy[goal.chapter_id] || { answered: 0, accuracy_recent: 0 };
  const target = goal.target_accuracy || 80;
  const title = `${ctx.chapterName(goal.chapter_id)} · reach ${target}%`;
  const reached = st.answered >= (ctx.minAnswered || 15) && st.accuracy_recent >= target;
  const today = jakartaDate();
  const due = goal.due_date ? String(goal.due_date) : null;
  const detail = `${st.answered ? `Now ${st.accuracy_recent}% (${st.answered} answers)` : 'Not practised yet'}${due ? ` · by ${new Date(due + 'T00:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}` : ''}`;
  if (reached) return { status: 'done', title, detail };
  if (due && due < today) return { status: 'overdue', title, detail };
  return { status: 'pending', title, detail };
}
