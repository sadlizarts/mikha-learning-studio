// Schedule screen (#/schedule): the school's assessment calendar, grouped by month, with the colours of the EASE sheet.
import { $, esc, jakartaDate } from '../ui.js';
import { loadAssessments } from '../store.js';
import { catalog, chapterIndex } from '../state.js';
import { show } from '../router.js';
import { assessmentRow, monthLabel, phase } from '../schedule.js';

let showPast = false;

export async function renderSchedule() {
  show('schedule');
  const body = $('#schedule-body');
  body.innerHTML = '<div class="loading" style="height:40vh"><div class="spin"></div></div>';
  let list, cat;
  try { [list, cat] = await Promise.all([loadAssessments(), catalog()]); }
  catch (e) { body.innerHTML = `<div class="panel sunk empty">${esc(e.message)}</div>`; return; }
  const idx = chapterIndex(cat), today = jakartaDate();
  const past = list.filter(a => phase(a, today) === 'past');
  const rest = list.filter(a => phase(a, today) !== 'past');
  const groups = new Map();
  for (const a of (showPast ? list : rest)) {
    const key = a.date_start.slice(0, 7);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(a);
  }
  body.innerHTML = `<div class="stack">
    <div class="legend"><span class="tp">Common Assessment · Teacher-paced</span><span class="sy">Common Assessment · Synchronized</span><span class="eg">EASE Growth</span></div>
    ${past.length ? `<button class="btn ghost small" id="pastbtn">${showPast ? 'Hide' : 'Show'} ${past.length} finished</button>` : ''}
    ${[...groups].map(([k, rows]) => `<div class="stack" style="gap:8px"><h3 class="month">${esc(monthLabel(k + '-01'))}</h3>
      <div class="panel asm-list">${rows.map(a => assessmentRow(a, { idx, statBy: cat.statBy, today })).join('')}</div></div>`).join('')
      || '<div class="panel sunk empty">No assessments on the calendar.</div>'}
    <p class="note" style="text-align:center">From the school's EASE schedule 2026–2027 · Grade 7</p>
  </div>`;
  const pb = $('#pastbtn');
  if (pb) pb.onclick = () => { showPast = !showPast; renderSchedule(); };
}
