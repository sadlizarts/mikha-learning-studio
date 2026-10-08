// Admin → Student dashboard (FR-60, FR-62).
import { $, $$, esc, fmtNum, fmtDur, levelInfo, jakartaDate, shortDay, scoreCls, trendSVG } from '../../ui.js';
import { admin } from '../../store.js';
import { catalog, chapterIndex } from '../../state.js';
import { chapterLabel, qTags, openEditor } from './common.js';
import { chaptersLabel } from '../home.js';

export async function renderStudent(body) {
  body.innerHTML = '<div class="spin"></div>';
  const cat = await catalog(); const idx = chapterIndex(cat);
  const students = await admin.students();
  if (!students.length) { body.innerHTML = '<div class="panel sunk empty">No student account yet.</div>'; return; }
  const st = students[0];
  const [att, prog, cstats, missed, lreads] = await Promise.all([admin.studentAttempts(st.id, 80), admin.studentProgress(st.id), admin.studentChapterStats(st.id), admin.mostMissed({ limit: 10 }), admin.lessonReads(st.id).catch(() => [])]);
  const R = cat.rules || {}; const NEEDS = +R.needs_work_threshold || 70, MIN = +R.min_answered || 15;
  const done = att.filter(a => a.status === 'completed');
  // Abandoned sessions with only a few answers are noise in the list (answers still count in the stats).
  const HIDE = R.hide_abandoned_below == null ? 5 : +R.hide_abandoned_below;
  const shown = att.filter(a => !(a.status === 'abandoned' && (a.answered_count || 0) < HIDE));
  const hidden = att.length - shown.length;
  const today = jakartaDate(); const weekAgo = Date.now() - 7 * 86400000;
  const last7 = done.filter(a => new Date(a.finished_at).getTime() >= weekAgo);
  const avg7 = last7.length ? Math.round(last7.reduce((t, a) => t + a.score, 0) / last7.length) : null;
  const yday = jakartaDate(Date.now() - 86400000);
  const streak = prog.last_completed_date && String(prog.last_completed_date) >= yday ? prog.current_streak : 0;
  const lv = levelInfo(prog.xp_total || 0);
  const trend = done.slice(0, 30).reverse().map(a => a.score);
  const chapRows = cstats.filter(c => idx[c.chapter_id]).sort((a, b) => a.accuracy_recent - b.accuracy_recent);
  const mq = missed.length ? await admin.questionsByIds(missed.map(m => m.question_id)) : [];
  const mStats = Object.fromEntries(missed.map(m => [m.question_id, m]));

  body.innerHTML = `<div class="stack">
    <div class="row between"><h3>${esc(st.display_name)}</h3><span class="note">Today ${esc(shortDay(new Date()))}</span></div>
    <div class="kpi">
      <div><div class="v num">${avg7 ?? '—'}</div><div class="l">Avg score 7 d</div></div>
      <div><div class="v num">${last7.length}</div><div class="l">Practices 7 d</div></div>
      <div><div class="v num">${streak}</div><div class="l">Streak (best ${prog.best_streak || 0})</div></div>
      <div><div class="v num">L${lv.level}</div><div class="l">${fmtNum(prog.xp_total)} XP</div></div>
    </div>
    <div class="panel"><div class="eyebrow" style="margin-bottom:6px">Score trend (last ${trend.length})</div>${trendSVG(trend, NEEDS)}</div>
    <div class="panel"><div class="eyebrow" style="margin-bottom:6px">Chapters (last 30 answers)</div>
      ${chapRows.length ? `<table class="tbl"><thead><tr><th>Chapter</th><th class="r">Acc.</th><th class="r">Hints</th><th class="r">Ans.</th></tr></thead><tbody>${chapRows.map(c => `<tr>
        <td>${esc(chapterLabel(idx, c.chapter_id))} ${c.answered >= MIN && c.accuracy_recent < NEEDS ? '<span class="tag bad">Needs work</span>' : ''}</td>
        <td class="r num" style="color:${c.accuracy_recent < NEEDS ? 'var(--bad)' : 'var(--ok)'};font-weight:900">${c.accuracy_recent}%</td>
        <td class="r num">${c.hint_rate_recent}%</td><td class="r num">${c.answered}</td></tr>`).join('')}</tbody></table>` : '<p class="note">No answers yet.</p>'}
    </div>
    <div class="panel"><div class="eyebrow" style="margin-bottom:6px">Lessons read</div>
      ${lreads.length ? `<table class="tbl"><thead><tr><th>Chapter</th><th class="r">Quick check</th><th class="r">Reads</th><th>Last</th></tr></thead><tbody>${lreads.map(r => `<tr>
        <td>${esc(chapterLabel(idx, r.chapter_id))}</td>
        <td class="r num">${r.quick_check_total ? `${r.quick_check_score}/${r.quick_check_total}` : '—'}</td>
        <td class="r num">${r.read_count}</td><td class="num">${esc(shortDay(r.last_read_at))}</td></tr>`).join('')}</tbody></table>` : '<p class="note">No lesson finished yet.</p>'}
    </div>
    <div class="panel"><div class="eyebrow" style="margin-bottom:6px">Sessions</div>
      ${shown.length ? `<table class="tbl"><thead><tr><th>When</th><th>Chapters</th><th class="r">Score</th><th class="r">Time</th></tr></thead><tbody>${shown.map(a => `<tr data-s="${a.id}" style="cursor:pointer">
        <td class="num">${esc(shortDay(a.finished_at || a.started_at))}</td>
        <td>${esc(chaptersLabel(a.chapter_ids, idx))}</td>
        <td class="r num">${a.status === 'completed' ? `<span class="tag ${scoreCls(a.score) === 'good' ? 'ok' : scoreCls(a.score) === 'low' ? 'bad' : 'warn'}">${a.score}</span>` : `<span class="tag mute">${esc(a.status)} ${a.answered_count}/${a.total_questions}</span>`}</td>
        <td class="r num">${a.duration_s ? fmtDur(a.duration_s) : '—'}</td></tr>`).join('')}</tbody></table>` : '<p class="note">No sessions yet.</p>'}
      ${hidden ? `<p class="note" style="margin-top:6px">${hidden} abandoned session${hidden > 1 ? 's' : ''} with fewer than ${HIDE} answers hidden (answers still count in the chapter stats).</p>` : ''}
    </div>
    <div class="panel"><div class="eyebrow" style="margin-bottom:6px">Most missed questions</div>
      <div class="stack" style="gap:8px">${mq.map(q => `<button class="qrow" data-q="${q.id}"><div class="note">${esc(chapterLabel(idx, q.chapter_id))}</div><div class="s">${esc(q.stem)}</div><div style="margin-top:6px">${qTags(q, mStats[q.id])}</div></button>`).join('') || '<p class="note">Needs at least 3 answers per question.</p>'}</div>
    </div>
  </div>`;
  $$('[data-s]', body).forEach(tr => tr.onclick = () => { location.hash = `#/session/${tr.dataset.s}`; });
  $$('[data-q]', body).forEach(b => b.onclick = async () => { if (await openEditor(mq.find(q => q.id === b.dataset.q), { idx, stats: mStats[b.dataset.q] })) renderStudent(body); });
}
