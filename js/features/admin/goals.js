// Admin → Goals (FR-61): daily target and chapter deadlines shown on Mikha's Home.
import { $, $$, esc, toast, sheet } from '../../ui.js';
import { admin, completedAttempts } from '../../store.js';
import { app, catalog, chapterIndex } from '../../state.js';
import { chapterOptions, chapterLabel } from './common.js';
import { goalStatus, dayName } from '../../goals.js';
import { jakartaDate } from '../../ui.js';

export async function renderGoals(body) {
  body.innerHTML = '<div class="spin"></div>';
  const cat = await catalog(); const idx = chapterIndex(cat);
  const [student] = await admin.students();
  if (!student) { body.innerHTML = '<div class="panel sunk empty">No student account yet.</div>'; return; }
  const [goals, cstats, done] = await Promise.all([admin.goals(student.id), admin.studentChapterStats(student.id), admin.studentAttempts(student.id, 30)]);
  const statBy = Object.fromEntries(cstats.map(c => [c.chapter_id, c]));
  const today = jakartaDate();
  const ctx = { sessionsToday: done.filter(a => a.status === 'completed' && jakartaDate(a.finished_at) === today).length, statBy, chapterName: (id) => chapterLabel(idx, id), minAnswered: +cat.rules?.min_answered || 15 };
  const label = { done: '<span class="tag ok">Done</span>', pending: '<span class="tag warn">Pending</span>', overdue: '<span class="tag bad">Overdue</span>', hidden: '<span class="tag mute">Not today</span>' };
  body.innerHTML = `<div class="stack">
    <div class="panel"><h3>Goals for ${esc(student.display_name)}</h3>
      ${goals.length ? `<table class="tbl" style="margin-top:8px"><thead><tr><th>Goal</th><th>Status</th><th></th></tr></thead><tbody>${goals.map(g => {
        const s = goalStatus(g, ctx);
        const desc = g.type === 'daily' ? `${g.sessions_per_day || 1}/day · ${(g.days_of_week?.length ? g.days_of_week : [1, 2, 3, 4, 5]).map(dayName).join(' ')}` : s.title;
        return `<tr><td>${esc(desc)}<div class="note">${esc(s.detail)}</div></td><td>${g.is_active ? label[s.status] : '<span class="tag mute">closed</span>'}</td>
          <td class="r"><button class="btn small" data-tog="${g.id}" data-on="${g.is_active ? 0 : 1}">${g.is_active ? 'Close' : 'Reopen'}</button></td></tr>`;
      }).join('')}</tbody></table>` : '<p class="note" style="margin-top:6px">No goals yet. Mikha sees active goals on Home as "Today\'s mission from Dad".</p>'}
    </div>
    <div class="panel"><h3>New daily target</h3>
      <label class="lbl">Practices per day</label><input type="number" id="g-n" min="1" max="5" value="1">
      <label class="lbl">Days</label><div class="row" style="flex-wrap:wrap;gap:6px">${[1, 2, 3, 4, 5, 6, 0].map(d => `<label class="tag" style="padding:4px 8px"><input type="checkbox" data-dow="${d}" ${d >= 1 && d <= 5 ? 'checked' : ''}> ${dayName(d)}</label>`).join('')}</div>
      <button class="btn primary block" id="g-daily" style="margin-top:12px">Add daily target</button>
    </div>
    <div class="panel"><h3>New chapter target</h3>
      <label class="lbl" for="g-ch">Chapter</label><select id="g-ch">${chapterOptions(cat)}</select>
      <div class="grid2"><div><label class="lbl" for="g-acc">Target accuracy %</label><input type="number" id="g-acc" min="50" max="100" value="80"></div>
      <div><label class="lbl" for="g-due">Due date</label><input type="date" id="g-due"></div></div>
      <button class="btn block" id="g-chap" style="margin-top:12px">Add chapter target</button>
      <p class="note" style="margin-top:6px">Done when the last 30 answers in that chapter reach the target (with at least ${ctx.minAnswered} answers).</p>
    </div>
  </div>`;
  $$('[data-tog]', body).forEach(b => b.onclick = async () => { try { await admin.setGoalActive(b.dataset.tog, b.dataset.on === '1'); renderGoals(body); } catch (e) { toast(e.message); } });
  $('#g-daily').onclick = async () => {
    const days = $$('[data-dow]', body).filter(c => c.checked).map(c => +c.dataset.dow);
    if (!days.length) { toast('Pick at least one day.'); return; }
    try { await admin.addGoal({ student_id: student.id, type: 'daily', days_of_week: days, sessions_per_day: Math.max(1, +$('#g-n').value || 1), created_by: app.user.id }); toast('Daily target added.'); renderGoals(body); } catch (e) { toast(e.message, 4000); }
  };
  $('#g-chap').onclick = async () => {
    const due = $('#g-due').value;
    try { await admin.addGoal({ student_id: student.id, type: 'chapter', chapter_id: $('#g-ch').value, target_accuracy: Math.min(100, Math.max(50, +$('#g-acc').value || 80)), due_date: due || null, created_by: app.user.id }); toast('Chapter target added.'); renderGoals(body); } catch (e) { toast(e.message, 4000); }
  };
}
