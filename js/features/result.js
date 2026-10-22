// Result (DESIGN §5.5) — also the read-only session detail opened from History.
import { rich, $, esc, band, fmtDur, subjectMeta, shortCode, toast, levelInfo, reducedMotion } from '../ui.js';
import { getAttempt, startAttempt, loadDojo, loadProgress } from '../store.js';
import { dojoFrom, openBoss } from './dojo.js';
import { monsterSVG, phaseOf } from '../monsters.js';
import { bossState, rules } from '../dojo.js';
import { STAGE_ART } from '../hero/art.js';
import { RANKS, bossSVG, cardSVG, beltSVG, cardTier, TIER_LABEL } from '../dojo.js';
import { app, catalog, chapterIndex } from '../state.js';
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
  let catR = null; try { const c0 = await catalog(); catR = { R: rules(c0), statBy: c0.statBy }; } catch { /* thumbnails fall back */ }
  const winAt = catR?.R?.win || 80;
  const chapRows = [...by].map(([cid, r]) => {
    const ch = idx[cid]; const m = subjectMeta(ch?.subject);
    const p = Math.round(100 * r.c / r.n), won = p >= winAt;
    let ph = 'boss'; try { const st = catR?.statBy?.[cid]; ph = st ? phaseOf(bossState(st, false, catR.R), catR.R) : 'minion'; if (ph === 'new') ph = 'minion'; if (ph === 'sealed') ph = 'boss'; } catch { /* default */ }
    return `<div class="chapbar rb-row ${won ? 'won' : 'lost'}" style="--c:${m.color}">${ch ? `<div class="rb-mon">${monsterSVG(ch, { phase: ph, size: 52 })}</div>` : ''}
      <div class="grow"><div class="lbl"><span>${esc(ch ? `${m.short} ${shortCode(ch.code)} · ${ch.name}` : 'Chapter')}</span><span class="num">${r.c}/${r.n}</span></div>
      <div class="bar" role="img" aria-label="${p}% correct"><i style="--p:${p}%;--c:${m.color}"></i></div>
      <div class="rb-tag">${won ? `Won this battle · ${p}%` : `It escaped · ${p}% (need ${winAt}%)`}</div></div></div>`;
  }).join('');

  const optText = (q, k) => q.options?.[k] ?? k;
  const wrong = answered.filter(q => !q.answer.is_correct);
  const mistakes = wrong.length ? wrong.map(q => `<div class="mistake">
      ${q.context ? `<div class="ctxq">${esc(q.context.length > 220 ? q.context.slice(0, 220) + '…' : q.context)}</div>` : ''}
      <div class="q">${rich(q.stem)}</div>
      <div class="ans"><span class="you">You: ${rich(optText(q, q.answer.chosen_key))}</span><span class="right">Correct: ${rich(optText(q, q.answer_key))}</span></div>
      <div class="ex">${rich(q.explanation || '')}</div>
      ${hasAnchor(lidx, q.chapter_id, q.lesson_anchor) ? `<button class="readlink" data-read="${q.chapter_id}" data-anchor="${esc(q.lesson_anchor)}">📖 Read: ${esc(anchorLabel(q.lesson_anchor))} ›</button>` : ''}</div>`).join('')
    : '<div class="panel sunk empty">Perfect run. Nothing to review! 🏆</div>';

  const xp = done?.xp_earned ?? a.xp_earned ?? 0;
  let levelUp = '';
  if (fresh && done?.progress) {
    const after = levelInfo(done.progress.xp_total), before = levelInfo(done.progress.xp_total - xp);
    if (after.level > before.level) levelUp = `<div class="panel" style="border-left:8px solid var(--volt)"><div class="eyebrow">Level up</div><b style="color:var(--ink);font-size:18px">You reached Level ${after.level} · ${after.tier}</b></div>`;
  }

  // Dojo (v1.8.0): rank exam verdict, XP cap / streak shield notes, boss report
  const er = a.exam_rank, ex = done?.exam;
  const passMark = ex?.pass_mark || 85;
  const examHtml = er ? (ex?.passed || (!ex && score >= passMark && !fresh)
    ? `<div class="panel rankup" style="--belt:${RANKS[er]?.color}"><div class="row" style="gap:14px;align-items:center">${beltSVG(RANKS[er]?.color || '#fff', 72)}<div><div class="eyebrow">Rank exam passed</div><div class="rankname">${fresh ? 'RANK UP! ' : ''}${esc(RANKS[er]?.name || '')}</div><div class="note">${esc(RANKS[er]?.belt || '')}</div></div></div></div>`
    : `<div class="panel sunk"><div class="eyebrow">Rank exam · ${esc(RANKS[er]?.name || '')}</div><b style="color:var(--ink)">${score}% — you need ${passMark}%.</b><div class="note">${fresh ? 'So close! Train your weakest bosses and try again tomorrow.' : 'Not passed.'}</div></div>`) : '';
  const notes = fresh ? [done?.capped ? `<div class="panel sunk note" style="font-size:14px">⚡ Daily XP cap reached: only the first answers each day give XP. Your answers still train your bosses. Time to rest! 💤</div>` : '',
    done?.froze ? `<div class="panel sunk note" style="font-size:14px">🛡️ Your streak shield saved your streak (you missed a day). It recharges in 7 days.</div>` : ''].join('') : '';

  body.innerHTML = `<div class="stack">
    <div class="panel result-hero">
      <div class="burst"></div>
      <div class="rh-ava ${score >= 65 ? 'happy' : 'sad'}" id="rhava" aria-hidden="true"></div>
      <div class="eyebrow" style="position:relative">${fresh ? 'Practice complete' : esc(new Date(a.finished_at).toLocaleString('en-GB', { timeZone: 'Asia/Jakarta', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))}</div>
      <div class="scorebig num" id="scorebig">${score}<small>/100</small></div>
      <div class="band ${bcls}">${btxt}</div>
    </div>
    <div class="kv">
      <div><div class="v num">${correct}/${qs.length}</div><div class="l">Correct</div></div>
      <div><div class="v num">${fmtDur(a.duration_s)}</div><div class="l">Time</div></div>
      <div><div class="v num">${hintsUsed}</div><div class="l">Hints used</div></div>
    </div>
    <div class="xpgain"><span aria-hidden="true" style="font-size:22px">⚡</span><div class="grow">XP earned${done?.counters ? `<div style="font-size:12px;font-weight:800;opacity:.8">incl. ${done.counters} counter strike${done.counters === 1 ? '' : 's'} (+${done.counters * 5})</div>` : ''}</div><b class="num">+${xp}</b></div>
    ${levelUp}
    ${examHtml}${notes}
    <div id="bossreport"></div>
    <div class="panel"><div class="eyebrow" style="margin-bottom:10px">Battles this session</div><div class="stack" style="gap:12px">${chapRows}</div></div>
    <div><h3 style="font-size:20px;margin-bottom:8px">Review mistakes${wrong.length ? ` <span class="note num">(${wrong.length})</span>` : ''}</h3><div class="stack" style="gap:10px">${mistakes}</div></div>
    <div class="row" style="gap:10px">
      <button class="btn block" style="flex:1" data-nav="#/home">Home</button>
      <button class="btn primary block" style="flex:1" id="againbtn">Again ↻</button>
    </div>
  </div>`;
  if (fresh) countUp($('#scorebig'), score);
  loadProgress().then(p => { const el = $('#rhava'); if (el) el.style.backgroundImage = `url(${STAGE_ART(p?.rank || 0)})`; }).catch(() => { /* avatar stays blank */ });
  if (fresh && !a.is_preview) bossReport(a, done).catch(() => { /* report is a bonus */ });
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

async function bossReport(a, done) {
  const el = $('#bossreport'); if (!el) return;
  const [cat, prog, dj] = await Promise.all([catalog(), loadProgress(), loadDojo(app.user.id)]);
  const d = dojoFrom(cat, prog, dj, false);
  const fresh = new Set(done?.new_bosses || []);
  const mine = d.bosses.filter(b => (a.chapter_ids || []).includes(b.ch.chapter_id));
  if (!mine.length) return;
  const sealed = mine.filter(b => fresh.has(b.ch.chapter_id));
  const reveal = sealed.map(b => `<div class="panel sealed" style="--c:${b.m.color}">
      <div class="eyebrow" style="color:var(--ok)">Boss sealed!</div>
      <div class="row" style="gap:14px;align-items:center;justify-content:center;flex-wrap:wrap">
        <div class="sealanim">${bossSVG(b.ch, b.m.color, { state: 'defeated', size: 96 })}</div>
        <div class="flipcard"><div class="face">${cardSVG(b.ch, b.m.color, cardTier(b.beaten?.best_accuracy || 80), { size: 96 })}</div></div>
      </div>
      <p style="text-align:center;margin-top:8px"><b>${esc(b.name)}</b> is sealed. New technique card: <b>${esc(b.tech)}</b> (${TIER_LABEL[cardTier(b.beaten?.best_accuracy || 80)]}).</p>
    </div>`).join('');
  const rows = mine.filter(b => !fresh.has(b.ch.chapter_id)).map(b => `<button class="brow" data-boss="${b.ch.chapter_id}" style="--c:${b.m.color}">
      ${bossSVG(b.ch, b.m.color, { state: b.st.status === 'defeated' ? 'defeated' : 'fight', size: 44 })}
      <div class="grow"><div style="font-weight:900;color:var(--ink)">${esc(b.name)} <span class="note">· ${esc(b.m.short)} ${esc(shortCode(b.ch.code))}</span></div>
      <div class="hp"><i style="--p:${b.st.hp}%"></i></div></div>
      <span class="note num">${b.st.status === 'defeated' ? 'Sealed' : 'HP ' + b.st.hp + '%'}</span></button>`).join('');
  el.innerHTML = `${reveal}${rows ? `<div class="panel"><div class="eyebrow" style="margin-bottom:8px">Boss report</div><div class="stack" style="gap:8px">${rows}</div></div>` : ''}`;
  el.querySelectorAll('[data-boss]').forEach(x => x.onclick = () => openBoss(d.bosses.find(b => b.ch.chapter_id === x.dataset.boss), false));
}
