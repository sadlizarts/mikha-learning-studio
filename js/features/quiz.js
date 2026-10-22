// Practice screen (DESIGN §5.4, PRD §7.4, §7.8, FR-22..FR-26).
// Feedback is shown instantly from the answer_key the client already has; the server grades again in answer_question.
import { rich, $, $$, esc, subjectMeta, shortCode, sheet, toast, pick, BULB, reducedMotion } from '../ui.js';
import { getAttempt, cachedAttempt, saveAnswer, completeAttempt, imageUrl, flushAnswers, loadProgress } from '../store.js';
import { catalog, chapterIndex } from '../state.js';
import { show, navigate, currentRoute } from '../router.js';
import { lessonsMeta, hasAnchor, openLessonSheet } from './learn.js';
import { anchorLabel } from '../lesson-md.js';
import { RANKS, rules, bossState, bossName } from '../dojo.js';
import { monsterSVG, examBoss, phaseOf, familyOf, formName, FAMILIES, GATE_ORDER } from '../monsters.js';
import { STAGE_ART } from '../hero/art.js';
import { staleWarning } from '../retreat.js';
import { myRetreats } from '../store.js';

const OK_WORDS = ['NICE!', 'BOOM!', 'SHARP!', 'GOT IT!', 'CLEAN!'];
const BAD_WORDS = ['ALMOST', 'NOT YET', 'HMM…'];
const OK_LINES = ['Nice hit!', 'Clean strike!', 'That one landed!', 'Keep the pressure on!', 'Great focus!'];
const BAD_LINES = ['It hit back. Read why below.', 'Shake it off, next one!', 'Learn the trick, then strike back.'];

/* ---- v2.4 light battle: the chapter's monster sits above the question; battle HP = share of this chapter's questions still unanswered-correctly ---- */
function battleSetup(cat) {
  const R = rules(cat), chs = cat ? Object.fromEntries(cat.chapters.map(c => [c.chapter_id, c])) : {};
  const er = S.data.attempt.exam_rank;
  let exam = null;
  if (er && cat) {
    const order = GATE_ORDER.filter(k => cat.chapters.some(c => familyOf(c) === k));
    exam = (order.length ? order : GATE_ORDER)[er % (order.length || GATE_ORDER.length)];
  }
  S.battle = { R, chs, statBy: cat?.statBy || {}, exam, angry: new Set() };
  const B = S.battle; myRetreats().then(r => { B.angry = new Set(r?.angry || []); if (S?.battle === B && !S.locked) { $('#arena').dataset.foe = ''; drawArena(qAt()); } }).catch(() => { /* optional */ });
}
function foeFor(q) {
  const B = S.battle; if (!B) return null;
  if (B.exam) { const f = FAMILIES[B.exam]; return { key: 'exam', name: f.forms[3], sub: `Exam Boss · ${f.name}`, html: examBoss(B.exam, { size: 150 }), color: f.c, pool: S.qs }; }
  const ch = B.chs[q.chapter_id] || S.idx[q.chapter_id]; if (!ch) return null;
  const st = B.statBy[q.chapter_id];
  let ph = st ? phaseOf(bossState(st, false, B.R), B.R) : 'minion';
  if (ph === 'new') ph = 'minion'; if (ph === 'sealed') ph = 'boss';
  const fam = familyOf(ch), m = subjectMeta(ch.subject || S.idx[q.chapter_id]?.subject);
  const angry = B.angry?.has(q.chapter_id);
  return { key: q.chapter_id, name: (angry ? '😠 ' : '') + bossName(ch, m.key).name, sub: `${angry ? 'Angry · ' : ''}${formName(fam, ph)} · ${m.short} ${shortCode(ch.code)}`, html: monsterSVG(ch, { phase: ph, size: 150, angry }), color: FAMILIES[fam].c, pool: S.qs.filter(x => x.chapter_id === q.chapter_id) };
}
const foeHp = (foe) => Math.max(0, Math.round(100 - 100 * foe.pool.filter(x => x.answer?.is_correct).length / Math.max(1, foe.pool.length)));
function drawArena(q, { swap = true } = {}) {
  const foe = foeFor(q), ar = $('#arena');
  ar.hidden = !foe; if (!foe) return null;
  if (swap && ar.dataset.foe !== foe.key) { $('#armon').innerHTML = foe.html; ar.dataset.foe = foe.key; ar.style.setProperty('--fc', foe.color); $('#arfx').innerHTML = ''; }
  $('#arname').textContent = `${foe.name} · ${foe.sub}`;
  const hp = foeHp(foe); $('#arhp').style.width = hp + '%'; $('#arhpt').textContent = `HP ${hp}%`;
  return foe;
}
function strike(ok, q, counter = false) {
  const ar = $('#arena'); if (ar.hidden) return;
  const foe = foeFor(q); if (!foe) return;
  const before = parseInt($('#arhp').style.width) || 100, hp = foeHp(foe);
  $('#arhp').style.width = hp + '%'; $('#arhpt').textContent = `HP ${hp}%`;
  const fx = $('#arfx'), mon = $('#armon .mon-wrap');
  if (ok) {
    fx.innerHTML = `<i class="ar-slash"></i><b class="ar-dmg">-${Math.max(1, before - hp)}</b>${hp === 0 ? '<b class="ar-ko">SEALED!</b>' : counter ? '<span class="ar-crit ar-counter">COUNTER STRIKE +5 XP</span>' : S.combo >= 5 ? '<span class="ar-crit">CRITICAL</span>' : ''}`;
    if (mon) { mon.classList.remove('hit'); void mon.offsetWidth; mon.classList.add('hit'); }
  } else {
    fx.innerHTML = '<i class="ar-claw"></i>';
    ar.classList.remove('counter'); void ar.offsetWidth; ar.classList.add('counter');
    document.querySelector('#s-quiz .qcard')?.classList.remove('shake'); void ar.offsetWidth; document.querySelector('#s-quiz .qcard')?.classList.add('shake');
    try { navigator.vibrate?.(120); } catch { /* not supported (iOS) */ }
  }
  const c = $('#arcombo');
  if (S.combo >= 2) { c.textContent = `×${S.combo} combo`; c.hidden = false; c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop'); } else c.hidden = true;
}

let S = null; // { data, qs, i, hint, t0, combo, idx, locked }

const qAt = () => S.qs[S.i];
const firstOpen = () => S.qs.findIndex(q => !q.answer);

export async function renderQuiz(id) {
  show('quiz');
  $('#stem').textContent = 'Loading…'; $('#opts').innerHTML = ''; $('#feedback').hidden = true; $('#hintbtn').hidden = true; $('#hints').innerHTML = ''; $('#ctx').hidden = true; $('#combo').hidden = true;
  let data;
  try { data = await getAttempt(id); }
  catch (e) {
    data = cachedAttempt(id);
    if (!data) { toast(e.message, 3500); navigate('#/home', { replace: true }); return; }
    toast("You're offline. Answers will sync later.", 2500);
  }
  const st = data.attempt.status;
  if (st === 'completed') { navigate(`#/session/${id}`, { replace: true }); return; }
  if (st !== 'in_progress') { toast('That practice was closed. Start a new one from Home.', 3000); navigate('#/home', { replace: true }); return; }
  let idx = {}, cat = null;
  try { cat = await catalog(); idx = chapterIndex(cat); } catch { /* chip falls back to plain text */ }
  S = { data, qs: data.questions, i: 0, hint: 0, t0: 0, combo: 0, idx, locked: false, lidx: null, prevOk: null };
  try { battleSetup(cat); } catch { S.battle = null; }
  $('#arena').dataset.foe = '';
  loadProgress().then(p => { $('#mk-quiz').style.backgroundImage = `url(${STAGE_ART(p?.rank || 0)})`; }).catch(() => { $('#mk-quiz').style.backgroundImage = `url(${STAGE_ART(0)})`; });
  const mine = S;
  lessonsMeta().then(x => { mine.lidx = x; }).catch(() => { /* Read links just stay hidden */ });
  const open = firstOpen();
  if (open === -1) { finish(); return; }
  S.i = open;
  $('#progwrap').setAttribute('aria-valuemax', S.qs.length);
  const eb = $('#exambanner'), er = data.attempt.exam_rank;
  eb.hidden = !er;
  if (er) {
    let pass = 85; try { pass = +(await catalog()).rules?.exam_pass || 85; } catch { /* default */ }
    eb.innerHTML = `🥋 <b>Rank exam · ${esc((RANKS[er] || {}).name || '')}</b> <span>Pass with ${pass}% or more</span>`;
  }
  renderQ();
}

function renderQ() {
  const q = qAt();
  S.hint = 0; S.locked = false; S.t0 = performance.now();
  const n = S.qs.length, done = S.qs.filter(x => x.answer).length;
  $('#qcount').textContent = `${S.i + 1} / ${n}`;
  $('#progbar').style.width = (done / n * 100) + '%';
  $('#progwrap').setAttribute('aria-valuenow', done);

  const ch = S.idx[q.chapter_id];
  const m = subjectMeta(ch?.subject);
  $('#qchip').style.setProperty('--c', m.color);
  $('#qchip .txt').textContent = ch ? `${m.short} · ${shortCode(ch.code)} ${ch.name}` : 'Practice';
  try { drawArena(q); } catch { $('#arena').hidden = true; }

  // context panel (FR-22c): folded when the previous question used the same text
  const ctx = $('#ctx');
  if (q.context) {
    const prev = S.qs[S.i - 1];
    const same = prev && prev.context_id && prev.context_id === q.context_id;
    ctx.hidden = false;
    ctx.classList.toggle('folded', !!same);
    ctx.innerHTML = same
      ? `<button class="fold" aria-expanded="false"><span>Same text as before — tap to open</span><span aria-hidden="true">⌄</span></button><div class="body">${rich(q.context)}</div>`
      : `<div class="eyebrow">Read this first</div><div class="body">${rich(q.context)}</div>`;
  } else ctx.hidden = true;

  $('#stem').innerHTML = rich(q.stem);
  const img = $('#qimg');
  img.hidden = true; img.innerHTML = '';
  if (q.image_path) imageUrl(q.image_path).then(url => {
    if (!url || qAt() !== q) return;
    img.innerHTML = `<img src="${esc(url)}" alt="Picture for this question">`; img.hidden = false; img.onclick = () => window.open(url, '_blank', 'noopener');
  });

  const order = q.option_order || ['A', 'B', 'C', 'D'];
  $('#opts').innerHTML = order.map((orig, pos) =>
    `<button class="opt" data-orig="${orig}"><span class="k" aria-hidden="true">${'ABCD'[pos]}</span><span class="grow">${rich(q.options[orig])}</span></button>`).join('');

  $('#hints').innerHTML = '';
  const hints = (q.hints || []).filter(Boolean);
  const hb = $('#hintbtn');
  hb.hidden = hints.length === 0;
  hb.innerHTML = `${BULB} Need a hint?`;
  $('#feedback').hidden = true;
  $('#readlink').hidden = true;
  $('#syncnote').hidden = true;
  $('#combo').hidden = true;
  $('#arfx').innerHTML = '';
  $('#qscroll').scrollTop = 0;
}

function showHint() {
  const q = qAt(); const hints = (q.hints || []).filter(Boolean);
  if (S.locked || S.hint >= hints.length) return;
  const tag = hints.length === 1 ? 'Hint · Remember' : S.hint === 0 ? 'Hint 1 · Remember' : 'Hint 2 · Next step';
  $('#hints').insertAdjacentHTML('beforeend', `<div class="hintbox"><span class="tag">${tag}</span><div>${rich(hints[S.hint])}</div></div>`);
  S.hint++;
  const hb = $('#hintbtn');
  if (S.hint >= hints.length) hb.hidden = true; else hb.innerHTML = `${BULB} Another hint`;
}

async function choose(orig) {
  if (S.locked) return;
  S.locked = true;
  const q = qAt();
  const ok = orig === q.answer_key;
  const ms = Math.round(performance.now() - S.t0);
  q.answer = { chosen_key: orig, is_correct: ok, hint_level: S.hint };

  $$('.opt').forEach(o => {
    o.disabled = true;
    const k = o.dataset.orig;
    if (k === q.answer_key) { o.classList.add('correct'); o.querySelector('.k').textContent = '✓'; }
    else if (k === orig) { o.classList.add('wrong'); o.querySelector('.k').textContent = '✕'; }
    else o.classList.add('dim');
  });
  $('#hintbtn').hidden = true;

  const counter = ok && S.prevOk === false; S.prevOk = ok;
  S.combo = ok ? S.combo + 1 : 0;
  const imp = $('#impact');
  imp.textContent = counter ? 'COUNTER!' : ok ? pick(OK_WORDS) : pick(BAD_WORDS);
  imp.className = 'impact' + (ok ? '' : ' bad');
  const mk = $('#mk-quiz'); mk.classList.remove('happy', 'sad'); void mk.offsetWidth; mk.classList.add(ok ? 'happy' : 'sad');
  $('#mkline').textContent = counter ? 'Counter strike! +5 XP for bouncing back.' : ok ? pick(OK_LINES) : pick(BAD_LINES);
  try { strike(ok, q, counter); } catch { /* battle is decoration */ }
  $('#explain').className = 'panel explain' + (ok ? '' : ' bad');
  $('#explain-h').textContent = ok ? "Why it's right" : 'What to remember';
  $('#exptext').innerHTML = rich(q.explanation || '');
  const rl = $('#readlink');
  rl.hidden = !(!ok && hasAnchor(S.lidx, q.chapter_id, q.lesson_anchor));
  if (!rl.hidden) rl.innerHTML = `📖 Read: ${esc(anchorLabel(q.lesson_anchor))} ›`;
  const n = S.qs.length, done = S.qs.filter(x => x.answer).length;
  $('#progbar').style.width = (done / n * 100) + '%';
  $('#progwrap').setAttribute('aria-valuenow', done);
  const c = $('#combo');
  if (S.combo >= 3 && $('#arena').hidden) { c.textContent = `🔥 ${S.combo} in a row!`; c.hidden = false; c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop'); }
  if (ok && S.combo >= 5 && S.combo % 5 === 0) surge(S.combo);
  const last = firstOpen() === -1;
  $('#nextbtn').textContent = last ? 'See results →' : 'Next →';
  $('#feedback').hidden = false;
  setTimeout(() => $('#nextbtn').scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'end' }), $('#arena').hidden || reducedMotion() ? 80 : 700);   // let the strike play first

  const attemptId = S.data.attempt.id;
  const synced = await saveAnswer(attemptId, q.question_id, orig, q.answer.hint_level, ms);
  if (!synced && qAt() === q) $('#syncnote').hidden = false;
}

const SURGE = ['KI SURGE!', 'SPIRIT BURST!', 'UNSTOPPABLE!', 'LEGEND MODE!', 'PERFECT FLOW!', 'GRANDMASTER!'];
function surge(n) {
  const el = $('#surge');
  el.innerHTML = `<b>${SURGE[Math.min(SURGE.length, n / 5) - 1]}</b><span class="num">×${n} combo</span>`;
  el.hidden = false; el.classList.remove('go'); void el.offsetWidth; el.classList.add('go');
  clearTimeout(surge.t); surge.t = setTimeout(() => { el.hidden = true; }, reducedMotion() ? 1200 : 1500);
}

async function next() {
  const open = firstOpen();
  if (open !== -1) { S.i = open; renderQ(); return; }
  finish();
}

async function finish() {
  const btn = $('#nextbtn');
  btn.disabled = true; btn.textContent = 'Scoring…';
  const id = S.data.attempt.id;
  try {
    const res = await completeAttempt(id);
    try { sessionStorage.setItem('mls_done_' + id, JSON.stringify(res)); } catch { /* ignore */ }
    navigate(`#/result/${id}`, { replace: true });
  } catch (e) {
    toast(e.code === 'network' ? "Can't reach the server. Your answers are safe — tap again when you're online." : e.message, 3500);
    btn.textContent = 'See results →';
  } finally { btn.disabled = false; }
}

/* events (bound once) */
$('#opts').addEventListener('click', e => { const b = e.target.closest('.opt'); if (b && S) choose(b.dataset.orig); });
$('#hintbtn').addEventListener('click', showHint);
$('#readlink').addEventListener('click', () => { const q = S && qAt(); if (q) openLessonSheet(q.chapter_id, q.lesson_anchor); });
$('#nextbtn').addEventListener('click', () => { if (S && S.locked) next(); });
$('#ctx').addEventListener('click', e => {
  const f = e.target.closest('.fold'); if (!f) return;
  const ctx = $('#ctx'); const open = ctx.classList.toggle('folded') === false;
  f.setAttribute('aria-expanded', open);
});
$('#quitbtn').addEventListener('click', async () => {
  const warn = S ? await staleWarning(S.qs.filter(q => q.answer).length) : '';
  const leave = await sheet({
    title: 'Leave this practice?',
    body: "Your answers so far are saved. You can continue later from Home, but you won't get a score until you finish." + warn,
    actions: [{ label: 'Keep going', value: false }, { label: 'Leave', value: true, cls: 'danger' }],
  });
  if (leave) { if (S) flushAnswers(S.data.attempt.id); navigate('#/home'); toast('Saved. Continue anytime from Home.'); }
});
document.addEventListener('keydown', e => {
  if (currentRoute()?.name !== 'quiz' || !S || document.querySelector('.sheet, .lsheet')) return;
  if (e.target.closest('input,textarea')) return;
  const k = e.key.toLowerCase();
  const pos = ['1', '2', '3', '4'].indexOf(k) !== -1 ? +k - 1 : ['a', 'b', 'c', 'd'].indexOf(k);
  if (!S.locked && pos >= 0) { const o = $$('.opt')[pos]; if (o) choose(o.dataset.orig); e.preventDefault(); }
  else if (S.locked && e.key === 'Enter' && !e.target.closest('button')) { next(); e.preventDefault(); }
  else if (!S.locked && k === 'h') { showHint(); e.preventDefault(); }
});
window.addEventListener('online', () => { if (S) flushAnswers(S.data.attempt.id).then(ok => { if (ok) $('#syncnote').hidden = true; }); });
