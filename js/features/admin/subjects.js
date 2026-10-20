// Admin → Subjects: progress per subject for the student (Sadli, 21 Oct 2026).
// Accuracy, answers, hints, chapter coverage, Learn read, sessions, active time and a per-subject trend,
// for the last 7 days / 30 days / all time. Chapter accuracy stays "last 30 answers" (same rule as Needs work).
import { $, $$, esc, fmtNum, fmtDur, shortDay, shortCode, subjectMeta, trendSVG } from '../../ui.js';
import { admin, lessonIndex } from '../../store.js';
import { catalog, chapterIndex } from '../../state.js';

const PERIODS = [['7', '7 days'], ['30', '30 days'], ['all', 'All time']];
const CAP_MS = 5 * 60 * 1000;   // one answer counts at most 5 min of active time (idle tabs inflate time_ms)
let period = '30';

export async function renderSubjects(body) {
  body.innerHTML = '<div class="spin"></div>';
  const cat = await catalog(); const idx = chapterIndex(cat);
  const [st] = await admin.students();
  if (!st) { body.innerHTML = '<div class="panel sunk empty">No student account yet.</div>'; return; }
  const since = period === 'all' ? null : new Date(Date.now() - (+period) * 86400000).toISOString();
  const [answers, reads, lidx] = await Promise.all([admin.studentAnswers(st.id, since), admin.lessonReads(st.id).catch(() => []), lessonIndex().catch(() => ({}))]);
  const R = cat.rules || {}; const NEEDS = +R.needs_work_threshold || 70, MIN = +R.min_answered || 15;
  const readBy = Object.fromEntries(reads.map(r => [r.chapter_id, r]));

  // group answers → subject → chapter / attempt
  const S = {};
  for (const s of cat.subjects) S[s.id] = { s, n: 0, ok: 0, hint: 0, ms: 0, chap: {}, att: {}, last: null };
  for (const a of answers) {
    const ch = idx[a.questions?.chapter_id]; if (!ch) continue;
    const g = S[ch.subject_id]; if (!g) continue;
    g.n++; if (a.is_correct) g.ok++; if ((a.hint_level || 0) > 0) g.hint++;
    g.ms += Math.min(a.time_ms || 0, CAP_MS);
    const c = g.chap[ch.chapter_id] ||= { n: 0, ok: 0, last: null }; c.n++; if (a.is_correct) c.ok++; if (!c.last || a.answered_at > c.last) c.last = a.answered_at;
    const t = g.att[a.attempt_id] ||= { n: 0, ok: 0, at: a.answered_at }; t.n++; if (a.is_correct) t.ok++; if (a.answered_at < t.at) t.at = a.answered_at;
    if (!g.last || a.answered_at > g.last) g.last = a.answered_at;
  }
  const pct = (ok, n) => n ? Math.round(100 * ok / n) : null;
  const tot = Object.values(S).reduce((t, g) => ({ n: t.n + g.n, ok: t.ok + g.ok, ms: t.ms + g.ms }), { n: 0, ok: 0, ms: 0 });
  const sessions = new Set(answers.map(a => a.attempt_id)).size;
  const color = (p) => p == null ? 'var(--ink-3)' : p < NEEDS ? 'var(--bad)' : 'var(--ok)';

  const card = (g) => {
    const m = subjectMeta(g.s);
    const chs = cat.chapters.filter(c => c.subject_id === g.s.id).sort((a, b) => a.sort_order - b.sort_order);
    const practisedEver = chs.filter(c => (cat.statBy[c.chapter_id]?.answered || 0) > 0).length;
    const practisedNow = chs.filter(c => g.chap[c.chapter_id]).length;
    const withLesson = chs.filter(c => lidx[c.chapter_id]);
    const doneLesson = withLesson.filter(c => readBy[c.chapter_id]?.first_completed_at);
    const qc = doneLesson.map(c => readBy[c.chapter_id]).filter(r => r.quick_check_total);
    const qcAvg = qc.length ? Math.round(100 * qc.reduce((t, r) => t + r.quick_check_score, 0) / qc.reduce((t, r) => t + r.quick_check_total, 0)) : null;
    const acc = pct(g.ok, g.n);
    const trend = Object.values(g.att).sort((a, b) => a.at < b.at ? -1 : 1).slice(-12).map(t => pct(t.ok, t.n));
    const rows = chs.map(c => {
      const s = cat.statBy[c.chapter_id], p = g.chap[c.chapter_id], r = readBy[c.chapter_id], L = lidx[c.chapter_id];
      const pagesRead = r?.pages_read?.length || 0, pages = L?.pages?.length || 0;
      const learn = !L ? '—' : r?.first_completed_at ? `✓${r.quick_check_total ? ` ${r.quick_check_score}/${r.quick_check_total}` : ''}` : pages ? `${pagesRead}/${pages} p.` : '·';
      const rec = s?.answered ? s.accuracy_recent : null;
      return `<tr>
        <td><b>${esc(shortCode(c.code))}</b> ${esc(c.name)}${s?.answered >= MIN && rec < NEEDS ? ' <span class="tag bad">Needs work</span>' : ''}${!s?.answered ? ' <span class="tag mute">Not yet</span>' : ''}</td>
        <td class="r num" style="color:${color(rec)};font-weight:900">${rec == null ? '—' : rec + '%'}</td>
        <td class="r num">${p ? `${p.n} · ${pct(p.ok, p.n)}%` : '—'}</td>
        <td class="r num">${learn}</td>
        <td class="num">${p?.last ? esc(shortDay(p.last)) : ''}</td></tr>`;
    }).join('');
    return `<div class="panel" style="border-left:8px solid ${m.color}">
      <div class="row between"><h3>${esc(m.short)}</h3><span class="note">${g.last ? 'Last ' + esc(shortDay(g.last)) : 'No practice in this period'}</span></div>
      <div class="kpi" style="margin-top:8px">
        <div><div class="v num" style="color:${color(acc)}">${acc == null ? '—' : acc + '%'}</div><div class="l">Accuracy</div></div>
        <div><div class="v num">${fmtNum(g.n)}</div><div class="l">Answers · hints ${g.n ? pct(g.hint, g.n) : 0}%</div></div>
        <div><div class="v num">${Object.keys(g.att).length}</div><div class="l">Sessions</div></div>
        <div><div class="v num">${fmtDur(g.ms / 1000)}</div><div class="l">Active time</div></div>
      </div>
      <div class="stack" style="gap:10px;margin-top:10px">
        <div class="chapbar"><div class="lbl"><span>Chapters practised</span><span class="num">${period === 'all' ? practisedEver : practisedNow} / ${chs.length}${period === 'all' ? '' : ` · ever ${practisedEver}`}</span></div><div class="bar"><i style="--p:${chs.length ? Math.round(100 * (period === 'all' ? practisedEver : practisedNow) / chs.length) : 0}%;--c:${m.color}"></i></div></div>
        <div class="chapbar"><div class="lbl"><span>Lessons finished</span><span class="num">${doneLesson.length} / ${withLesson.length}${qcAvg != null ? ` · quick check ${qcAvg}%` : ''}</span></div><div class="bar"><i style="--p:${withLesson.length ? Math.round(100 * doneLesson.length / withLesson.length) : 0}%;--c:${m.color}"></i></div></div>
      </div>
      ${trend.length >= 2 ? `<div style="margin-top:10px"><div class="eyebrow" style="margin-bottom:4px">${esc(m.short)} score per session · last ${trend.length}</div>${trendSVG(trend, NEEDS, { H: 100 })}</div>` : ''}
      <details style="margin-top:10px"><summary class="note" style="cursor:pointer;font-weight:900">Chapters (${chs.length})</summary>
        <table class="tbl" style="margin-top:6px"><thead><tr><th>Chapter</th><th class="r">Last 30</th><th class="r">${period === 'all' ? 'All' : period + ' d'}</th><th class="r">Learn</th><th>Last</th></tr></thead><tbody>${rows}</tbody></table>
      </details>
    </div>`;
  };

  body.innerHTML = `<div class="stack">
    <div class="row between" style="flex-wrap:wrap;gap:8px"><h3>${esc(st.display_name)} · subjects</h3>
      <div class="row" style="gap:6px">${PERIODS.map(([k, l]) => `<button class="btn small ${k === period ? 'primary' : ''}" data-p="${k}">${l}</button>`).join('')}</div></div>
    <div class="kpi">
      <div><div class="v num" style="color:${color(pct(tot.ok, tot.n))}">${tot.n ? pct(tot.ok, tot.n) + '%' : '—'}</div><div class="l">Accuracy</div></div>
      <div><div class="v num">${fmtNum(tot.n)}</div><div class="l">Answers</div></div>
      <div><div class="v num">${sessions}</div><div class="l">Sessions</div></div>
      <div><div class="v num">${fmtDur(tot.ms / 1000)}</div><div class="l">Active time</div></div>
    </div>
    ${cat.subjects.map(s => card(S[s.id])).join('')}
    <p class="note">Accuracy, answers, sessions and time count only answers in the chosen period (Dad's preview practice is not included). "Last 30" is the chapter accuracy over its last 30 answers, the rule used for Needs work. Active time counts at most 5 minutes per answer. A session that mixes subjects counts once for each subject.</p>
  </div>`;
  $$('[data-p]', body).forEach(b => b.onclick = () => { period = b.dataset.p; renderSubjects(body); });
}
