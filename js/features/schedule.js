// Schedule screen (#/schedule): the school's assessment calendar, grouped by month, with the colours of the EASE sheet.
// v3.6.0: the final-exam plan (Dad's day-by-day tasks, kind 'prep') is shown as its own panel above the calendar.
import { $, esc, jakartaDate } from '../ui.js';
import { loadAssessments, completedAttempts, myLessonReads } from '../store.js';
import { catalog, chapterIndex, viewerId } from '../state.js';
import { show } from '../router.js';
import { assessmentRow, monthLabel, phase, onCalendar, metaOf, timeTxt, KIND } from '../schedule.js';
import { examPlanDays } from '../plan.js';
import { lessonsMeta } from './learn.js';

let showPast = false;
const dayLbl = (iso) => new Intl.DateTimeFormat('en-GB', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' })
  .format(new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10))));

function planPanel(days, today) {
  if (!days.length) return '';
  const all = days.flatMap(d => d.items), doneN = days.filter(d => d.day <= today).flatMap(d => d.items).filter(i => i.done).length;
  const dueN = days.filter(d => d.day <= today).flatMap(d => d.items).length;
  return `<div class="panel xplan">
    <div class="row between"><h3>Final exam plan</h3><span class="note num">${dueN ? `${doneN}/${dueN} done so far` : `${all.length} tasks`}</span></div>
    <p class="note" style="margin:2px 0 8px">Two subjects a day, weakest chapters first. From 3 Dec: dress rehearsals in exam order.</p>
    <div class="xdays">${days.map(d => {
      const st = d.day < today ? 'past' : d.day === today ? 'today' : 'next';
      return `<div class="xday ${st}">
        <div class="xd num">${esc(dayLbl(d.day))}${st === 'today' ? '<b>Today</b>' : ''}</div>
        <div class="grow">
          ${d.exams.map(e => `<div class="xex ${e.kind}" style="--c:${metaOf(e).color}">${e.kind === 'final' ? 'EXAM' : 'NOTE'} · ${esc(e.subject_name ? metaOf(e).short : (e.title || 'School'))}${timeTxt(e) ? ` · ${esc(timeTxt(e))}` : ''}</div>`).join('')}
          ${d.items.map(i => `<div class="xt ${i.done ? 'ok' : ''}" style="--c:${i.color}"><span class="dot"></span>${esc(i.title)}${i.done ? ' ✓' : ''}</div>`).join('')}
        </div></div>`;
    }).join('')}</div>
  </div>`;
}

export async function renderSchedule() {
  show('schedule');
  const body = $('#schedule-body');
  body.innerHTML = '<div class="loading" style="height:40vh"><div class="spin"></div></div>';
  let list, cat, attempts = [], reads = {}, lessons = {};
  try {
    const vid = viewerId();
    [list, cat, attempts, reads, lessons] = await Promise.all([loadAssessments(), catalog(), completedAttempts(vid, 200).catch(() => []),
      myLessonReads(vid), lessonsMeta().catch(() => ({}))]);
  } catch (e) { body.innerHTML = `<div class="panel sunk empty">${esc(e.message)}</div>`; return; }
  list = [...list].sort((x, y) => x.date_start.localeCompare(y.date_start) || (x.time_start || '').localeCompare(y.time_start || '') || (x.subject_name || '').localeCompare(y.subject_name || ''));   // same day: earliest time first
  const idx = chapterIndex(cat), today = jakartaDate();
  const days = examPlanDays(list, { cat, idx, attempts, reads, lessons });
  const cal = list.filter(onCalendar);
  const past = cal.filter(a => phase(a, today) === 'past');
  const rest = cal.filter(a => phase(a, today) !== 'past');
  const groups = new Map();
  for (const a of (showPast ? cal : rest)) {
    const key = a.date_start.slice(0, 7);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(a);
  }
  const hasFinal = cal.some(a => a.kind === 'final'), hasRem = cal.some(a => a.kind === 'reminder');
  body.innerHTML = `<div class="stack">
    ${planPanel(days, today)}
    <div class="legend"><span class="tp">Common Assessment · Teacher-paced</span><span class="sy">Common Assessment · Synchronized</span><span class="eg">EASE Growth</span>${hasFinal ? `<span class="fx">${esc(KIND.final.label)}</span>` : ''}${hasRem ? '<span class="rm">Reminder</span>' : ''}</div>
    ${past.length ? `<button class="btn ghost small" id="pastbtn">${showPast ? 'Hide' : 'Show'} ${past.length} finished</button>` : ''}
    ${[...groups].map(([k, rows]) => `<div class="stack" style="gap:8px"><h3 class="month">${esc(monthLabel(k + '-01'))}</h3>
      <div class="panel asm-list">${rows.map(a => assessmentRow(a, { idx, statBy: cat.statBy, today })).join('')}</div></div>`).join('')
      || '<div class="panel sunk empty">No assessments on the calendar.</div>'}
    <p class="note" style="text-align:center">From the school's EASE schedule 2026–2027 · Grade 7</p>
  </div>`;
  const pb = $('#pastbtn');
  if (pb) pb.onclick = () => { showPast = !showPast; renderSchedule(); };
}
