// Result (DESIGN §5.5) — also the read-only session detail opened from History.
import { $, esc, band, fmtDur, subjectMeta, shortCode, toast, levelInfo, reducedMotion } from '../ui.js';
import { getAttempt, startAttempt } from '../store.js';
import { catalog, chapterIndex } from '../state.js';
import { show, navigate } from '../router.js';
import { lessonsMeta, hasAnchor, openLessonSheet } from './learn.js';
import { anchorLabel } from '../lesson-md.js';

function countUp(el, target) {
  if (reducedMotion()) { el.innerHTML = `${target}<small>/100</small>`; return; }
  let v = 0; const step = Math.max(1, Math.ceil(target / 22));
  const tick = () => { v = Math.min(target, v + step); el.innerHTML = `${v}<small>/100</small>`; if (v < target) requestAnimationFrame(tick); };
  tick();
}

export async function renderResult(id, { fresh }) {
  show('result');
  $('#result-top').hidden = fresh;
  $('#result-back').onclick = () => { if (history.length > 1) history.back(); else navigate('#/history'); };
  const body = $('#result-body');
  body.innerHTML = '<div class="loading" style="height:60vh"><div class="spin"></div></div>';
  let data, idx = {}, lidx = {};
  try {
    data = await getAttempt(id);
    try { lidx = await lessonsMeta(); } catch { /* no Read links */ }
    try { idx = chapterIndex(await catalog(true)); } catch { /* names fall back */ }
  } catch (e) {
    body.innerHTML = `<div class="panel sunk empty" style="margin-top:40px">${esc(e.message)}<button class="btn block" style="margin-top:12px" data-nav="#/home">Home</button></div>`;
    return;
  }
  const a = data.attempt, qs = data.questions || [];
  if (a.status !== 'completed') {
    body.innerHTML = `<div class="panel sunk empty" style="margin-top:40px">This practice isn't finished yet.<button class="btn primary block" style="margin-top:12px" data-nav="#/quiz/${a.id}">Continue →</button></div>`;
    return;
  }
  let done = null;
  try { done = JSON.parse(sessionStorage.getItem('mls_done_' + id) || 'null'); } catch { /* ignore */ }

  const answered = qs.filter(q => q.answer);
  const correct = answered.filter(q => q.answer.is_correct).length;
  const score = a.score ?? Math.round(100 * correct / Math.max(1, qs.length));
  const hintsUsed = answered.filter(q => (q.answer.hint_level || 0) > 0).length;
  const [btxt, bcls] = band(score);

  // by chapter (session's own numbers, PRD §8.1)
  const by = new Map();
  for (const q of answered) {
    const r = by.get(q.chapter_id) || { c: 0, n: 0 }; r.n++; if (q.answer.is_correct) r.c++; by.set(q.chapter_id, r);
  }
  const chapRows = [...by].map(([cid, r]) => {
    const ch = idx[cid]; const m = subjectMeta(ch?.subject);
    const p = Math.round(100 * r.c / r.n);
    return `<div class="chapbar"><div class="lbl"><span>${esc(ch ? `${m.short} ${shortCode(ch.code)} · ${ch.name}` : 'Chapter')}</span><span class="num">${r.c}/${r.n}</span></div>
      <div class="bar" role="img" aria-label="${p}% correct"><i style="--p:${p}%;--c:${m.color}"></i></div></div>`;
  }).join('');

  const optText = (q, k) => q.options?.[k] ?? k;
  const wrong = answered.filter(q => !q.answer.is_correct);
  const mistakes = wrong.length ? wrong.map(q => `<div class="mistake">
      ${q.context ? `<div class="ctxq">${esc(q.context.length > 220 ? q.context.slice(0, 220) + '…' : q.context)}</div>` : ''}
      <div class="q">${esc(q.stem)}</div>
      <div class="ans"><span class="you">You: ${esc(optText(q, q.answer.chosen_key))}</span><span class="right">Correct: ${esc(optText(q, q.answer_key))}</span></div>
      <div class="ex">${esc(q.explanation || '')}</div>
      ${hasAnchor(lidx, q.chapter_id, q.lesson_anchor) ? `<button class="readlink" data-read="${q.chapter_id}" data-anchor="${esc(q.lesson_anchor)}">📖 Read: ${esc(anchorLabel(q.lesson_anchor))} ›</button>` : ''}</div>`).join('')
    : '<div class="panel sunk empty">Perfect run. Nothing to review! 🏆</div>';

  const xp = done?.xp_earned ?? a.xp_earned ?? 0;
  let levelUp = '';
  if (fresh && done?.progress) {
    const after = levelInfo(done.progress.xp_total), before = levelInfo(done.progress.xp_total - xp);
    if (after.level > before.level) levelUp = `<div class="panel" style="border-left:8px solid var(--volt)"><div class="eyebrow">Level up</div><b style="color:var(--ink);font-size:18px">You reached Level ${after.level} · ${after.tier}</b></div>`;
  }

  body.innerHTML = `<div class="stack">
    <div class="panel result-hero">
      <div class="burst"></div>
      <div class="eyebrow" style="position:relative">${fresh ? 'Practice complete' : esc(new Date(a.finished_at).toLocaleString('en-GB', { timeZone: 'Asia/Jakarta', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))}</div>
      <div class="scorebig num" id="scorebig">${score}<small>/100</small></div>
      <div class="band ${bcls}">${btxt}</div>
    </div>
    <div class="kv">
      <div><div class="v num">${correct}/${qs.length}</div><div class="l">Correct</div></div>
      <div><div class="v num">${fmtDur(a.duration_s)}</div><div class="l">Time</div></div>
      <div><div class="v num">${hintsUsed}</div><div class="l">Hints used</div></div>
    </div>
    <div class="xpgain"><span aria-hidden="true" style="font-size:22px">⚡</span><div class="grow">XP earned</div><b class="num">+${xp}</b></div>
    ${levelUp}
    <div class="panel"><div class="eyebrow" style="margin-bottom:10px">By chapter</div><div class="stack" style="gap:12px">${chapRows}</div></div>
    <div><h3 style="font-size:20px;margin-bottom:8px">Review mistakes${wrong.length ? ` <span class="note num">(${wrong.length})</span>` : ''}</h3><div class="stack" style="gap:10px">${mistakes}</div></div>
    <div class="row" style="gap:10px">
      <button class="btn block" style="flex:1" data-nav="#/home">Home</button>
      <button class="btn primary block" style="flex:1" id="againbtn">Again ↻</button>
    </div>
  </div>`;
  if (fresh) countUp($('#scorebig'), score);
  body.querySelectorAll('[data-read]').forEach(b => b.onclick = () => openLessonSheet(b.dataset.read, b.dataset.anchor));
  $('#result-body').scrollTop = 0;

  $('#againbtn').onclick = async (e) => {
    const b = e.currentTarget; b.disabled = true; b.textContent = 'Getting questions…';
    try {
      const d = await startAttempt(a.chapter_ids, a.requested_length || 30);
      navigate(`#/quiz/${d.attempt.id}`);
    } catch (ex) {
      toast(ex.code === 'in_progress' ? 'Finish or leave your other practice first (see Home).' : ex.message, 3500);
      b.disabled = false; b.textContent = 'Again ↻';
    }
  };
}
