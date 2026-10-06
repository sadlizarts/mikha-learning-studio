// Practice screen (DESIGN §5.4, PRD §7.4, §7.8, FR-22..FR-26).
// Feedback is shown instantly from the answer_key the client already has; the server grades again in answer_question.
import { $, $$, esc, setMascot, subjectMeta, shortCode, sheet, toast, pick, BULB, reducedMotion } from '../ui.js';
import { getAttempt, cachedAttempt, saveAnswer, completeAttempt, imageUrl, flushAnswers } from '../store.js';
import { catalog, chapterIndex } from '../state.js';
import { show, navigate, currentRoute } from '../router.js';

const OK_WORDS = ['NICE!', 'BOOM!', 'SHARP!', 'GOT IT!', 'CLEAN!'];
const BAD_WORDS = ['ALMOST', 'NOT YET', 'HMM…'];

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
  let idx = {};
  try { idx = chapterIndex(await catalog()); } catch { /* chip falls back to plain text */ }
  S = { data, qs: data.questions, i: 0, hint: 0, t0: 0, combo: 0, idx, locked: false };
  const open = firstOpen();
  if (open === -1) { finish(); return; }
  S.i = open;
  $('#progwrap').setAttribute('aria-valuemax', S.qs.length);
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

  // context panel (FR-22c): folded when the previous question used the same text
  const ctx = $('#ctx');
  if (q.context) {
    const prev = S.qs[S.i - 1];
    const same = prev && prev.context_id && prev.context_id === q.context_id;
    ctx.hidden = false;
    ctx.classList.toggle('folded', !!same);
    ctx.innerHTML = same
      ? `<button class="fold" aria-expanded="false"><span>Same text as before — tap to open</span><span aria-hidden="true">⌄</span></button><div class="body">${esc(q.context)}</div>`
      : `<div class="eyebrow">Read this first</div><div class="body">${esc(q.context)}</div>`;
  } else ctx.hidden = true;

  $('#stem').textContent = q.stem;
  const img = $('#qimg');
  img.hidden = true; img.innerHTML = '';
  if (q.image_path) imageUrl(q.image_path).then(url => {
    if (!url || qAt() !== q) return;
    img.innerHTML = `<img src="${esc(url)}" alt="Picture for this question">`; img.hidden = false; img.onclick = () => window.open(url, '_blank', 'noopener');
  });

  const order = q.option_order || ['A', 'B', 'C', 'D'];
  $('#opts').innerHTML = order.map((orig, pos) =>
    `<button class="opt" data-orig="${orig}"><span class="k" aria-hidden="true">${'ABCD'[pos]}</span><span class="grow">${esc(q.options[orig])}</span></button>`).join('');

  $('#hints').innerHTML = '';
  const hints = (q.hints || []).filter(Boolean);
  const hb = $('#hintbtn');
  hb.hidden = hints.length === 0;
  hb.innerHTML = `${BULB} Need a hint?`;
  $('#feedback').hidden = true;
  $('#syncnote').hidden = true;
  $('#combo').hidden = true;
  $('#qscroll').scrollTop = 0;
}

function showHint() {
  const q = qAt(); const hints = (q.hints || []).filter(Boolean);
  if (S.locked || S.hint >= hints.length) return;
  const tag = hints.length === 1 ? 'Hint · Remember' : S.hint === 0 ? 'Hint 1 · Remember' : 'Hint 2 · Next step';
  $('#hints').insertAdjacentHTML('beforeend', `<div class="hintbox"><span class="tag">${tag}</span><div>${esc(hints[S.hint])}</div></div>`);
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

  S.combo = ok ? S.combo + 1 : 0;
  const imp = $('#impact');
  imp.textContent = ok ? pick(OK_WORDS) : pick(BAD_WORDS);
  imp.className = 'impact' + (ok ? '' : ' bad');
  setMascot($('#m-quiz'), ok ? 'happy' : 'sad', ok ? 'happy' : 'sad');
  $('#explain').className = 'panel explain' + (ok ? '' : ' bad');
  $('#explain-h').textContent = ok ? "Why it's right" : 'What to remember';
  $('#exptext').textContent = q.explanation || '';
  const n = S.qs.length, done = S.qs.filter(x => x.answer).length;
  $('#progbar').style.width = (done / n * 100) + '%';
  $('#progwrap').setAttribute('aria-valuenow', done);
  const c = $('#combo');
  if (S.combo >= 3) { c.textContent = `🔥 ${S.combo} in a row!`; c.hidden = false; c.classList.remove('pop'); void c.offsetWidth; c.classList.add('pop'); }
  const last = firstOpen() === -1;
  $('#nextbtn').textContent = last ? 'See results →' : 'Next →';
  $('#feedback').hidden = false;
  setTimeout(() => $('#nextbtn').scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'end' }), 80);

  const attemptId = S.data.attempt.id;
  const synced = await saveAnswer(attemptId, q.question_id, orig, q.answer.hint_level, ms);
  if (!synced && qAt() === q) $('#syncnote').hidden = false;
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
$('#nextbtn').addEventListener('click', () => { if (S && S.locked) next(); });
$('#ctx').addEventListener('click', e => {
  const f = e.target.closest('.fold'); if (!f) return;
  const ctx = $('#ctx'); const open = ctx.classList.toggle('folded') === false;
  f.setAttribute('aria-expanded', open);
});
$('#quitbtn').addEventListener('click', async () => {
  const leave = await sheet({
    title: 'Leave this practice?',
    body: "Your answers so far are saved. You can continue later from Home, but you won't get a score until you finish.",
    actions: [{ label: 'Keep going', value: false }, { label: 'Leave', value: true, cls: 'danger' }],
  });
  if (leave) { if (S) flushAnswers(S.data.attempt.id); navigate('#/home'); toast('Saved. Continue anytime from Home.'); }
});
document.addEventListener('keydown', e => {
  if (currentRoute()?.name !== 'quiz' || !S || document.querySelector('.sheet')) return;
  if (e.target.closest('input,textarea')) return;
  const k = e.key.toLowerCase();
  const pos = ['1', '2', '3', '4'].indexOf(k) !== -1 ? +k - 1 : ['a', 'b', 'c', 'd'].indexOf(k);
  if (!S.locked && pos >= 0) { const o = $$('.opt')[pos]; if (o) choose(o.dataset.orig); e.preventDefault(); }
  else if (S.locked && e.key === 'Enter' && !e.target.closest('button')) { next(); e.preventDefault(); }
  else if (!S.locked && k === 'h') { showHint(); e.preventDefault(); }
});
window.addEventListener('online', () => { if (S) flushAnswers(S.data.attempt.id).then(ok => { if (ok) $('#syncnote').hidden = true; }); });
