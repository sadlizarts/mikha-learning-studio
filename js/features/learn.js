// Learn (PRD FR-73..FR-75, DESIGN §4.7b, §4.8b, §5.6b, §5.6c).
// #/learn → subject tabs + lesson rows; #/lesson/<chapterId>[/<anchor>] → lesson overview + list of pages + Quick check;
// #/lesson/<chapterId>/p/<slug>[/<anchor>] → one reading page (converted Study Studio chapter, v1.3.0).
// openLessonSheet() shows the lesson or the page that holds an anchor over the quiz/result (92 % bottom sheet).
import { $, $$, esc, setMascot, subjectMeta, shortCode, toast, reducedMotion } from '../ui.js';
import { lessonIndex, myLessonReads, loadLesson, lessonImages, completeLesson, loadPage, markPage, pageForAnchor } from '../store.js';
import { parseLesson, renderSections, inline } from '../lesson-md.js';
import { app, catalog, chapterIndex } from '../state.js';
import { show, navigate } from '../router.js';

let learnSub = null;
let lessonsCache = { at: 0, idx: null };

/** published-lesson index, cached 60 s (cheap; no bodies) */
export async function lessonsMeta(force = false) {
  if (force || !lessonsCache.idx || Date.now() - lessonsCache.at > 60000) {
    lessonsCache = { at: Date.now(), idx: await lessonIndex() };
  }
  return lessonsCache.idx;
}
export const hasAnchor = (lidx, chapterId, anchor) => !!(anchor && lidx?.[chapterId]?.anchors?.includes(anchor));

const isNeedsWork = (st, R) => st && st.answered >= (+R.min_answered || 15) && st.accuracy_recent < (+R.needs_work_threshold || 70);

/* ---------------- list ---------------- */
export async function renderLearn() {
  show('learn');
  const body = $('#learn-body');
  if (!body.dataset.ready) body.innerHTML = '<div class="loading" style="height:40vh"><div class="spin"></div></div>';
  let cat, lidx, reads;
  try { [cat, lidx, reads] = await Promise.all([catalog(), lessonsMeta(true), myLessonReads(app.user.id)]); }
  catch (e) { body.innerHTML = `<div class="panel sunk empty">${esc(e.message)}<button class="btn block" style="margin-top:12px" data-nav="#/learn">Try again ↻</button></div>`; return; }
  const R = cat.rules || {};
  if (!learnSub || !cat.subjects.some(s => s.id === learnSub)) {
    // start on the first subject that has a lesson
    const withLesson = cat.chapters.find(c => lidx[c.chapter_id]);
    learnSub = withLesson ? withLesson.subject_id : cat.subjects[0]?.id;
  }
  const tabs = cat.subjects.map(s => {
    const m = subjectMeta(s); const on = s.id === learnSub;
    const n = cat.chapters.filter(c => c.subject_id === s.id && lidx[c.chapter_id]).length;
    return `<button class="subtab ${on ? 'on' : ''}" style="--c:${m.color}" data-lsub="${s.id}" role="tab" aria-selected="${on}">${esc(m.short)}${n ? ` <span class="cnt num">${n}</span>` : ''}</button>`;
  }).join('');
  const s = cat.subjects.find(x => x.id === learnSub); const m = subjectMeta(s);
  const rows = cat.chapters.filter(c => c.subject_id === learnSub).map(c => {
    const L = lidx[c.chapter_id], r = reads[c.chapter_id], st = cat.statBy[c.chapter_id];
    if (!L) return `<div class="lrow soon" style="--c:${m.color}" aria-disabled="true"><div class="code">${esc(shortCode(c.code))}</div><div class="grow"><div class="name">${esc(c.name)}</div><div class="meta">Coming soon</div></div></div>`;
    const bits = [];
    if (r?.first_completed_at) bits.push('<span class="read">✓ Read</span>');
    if (isNeedsWork(st, R)) bits.push('<span class="nw">Needs work</span>');
    const pages = L.pages || [];
    const mins = (L.read_minutes || 0) + pages.reduce((t, p) => t + (p.read_minutes || 0), 0);
    if (pages.length) bits.push(`<span class="num">${(r?.pages_read || []).filter(x => pages.some(p => p.slug === x)).length}/${pages.length} pages</span>`);
    bits.push(`≈ ${mins || 6} min`);
    if (r?.quick_check_total) bits.push(`<span class="num">Quick check ${r.quick_check_score}/${r.quick_check_total}</span>`);
    return `<button class="lrow" style="--c:${m.color}" data-nav="#/lesson/${c.chapter_id}"><div class="code">${esc(shortCode(c.code))}</div><div class="grow"><div class="name">${esc(c.name)}</div><div class="meta">${bits.join(' · ')}</div></div><span aria-hidden="true" style="color:var(--ink-3);font-weight:900">›</span></button>`;
  }).join('');
  const total = Object.keys(lidx).length;
  body.innerHTML = `<div class="stack">
    <div class="subtabs" role="tablist" aria-label="Subjects">${tabs}</div>
    ${total ? '' : '<div class="panel sunk empty">No lessons published yet. Dad adds them in Admin → Lessons.</div>'}
    <div class="stack" style="gap:10px">${rows || '<div class="panel sunk empty">No chapters here yet.</div>'}</div>
  </div>`;
  body.dataset.ready = '1';
  $$('[data-lsub]', body).forEach(b => b.onclick = () => { learnSub = b.dataset.lsub; renderLearn(); });
}

/* ---------------- shared lesson view ---------------- */
/**
 * Fill `root` with a lesson. opts: { inSheet, anchor, onTitle(text) }.
 * Returns the parsed lesson or null.
 */
async function mountLesson(root, chapterId, { inSheet = false, anchor = null, onTitle = () => {} } = {}) {
  root.innerHTML = '<div class="loading" style="height:40vh"><div class="spin"></div></div>';
  let res, cat, reads = {}, lidx = {};
  try { [res, cat, lidx] = await Promise.all([loadLesson(chapterId), catalog().catch(() => null), lessonsMeta().catch(() => ({}))]); }
  catch (e) { root.innerHTML = `<div class="panel sunk empty">${esc(e.message)}</div>`; return null; }
  if (!res) { root.innerHTML = '<div class="panel sunk empty">This lesson is not published yet.</div>'; return null; }
  try { reads = await myLessonReads(app.user.id); } catch { /* optional */ }
  const ch = cat ? chapterIndex(cat)[chapterId] : null;
  const m = subjectMeta(ch?.subject);
  const p = parseLesson(res.lesson.body_md);
  const title = ch ? `${shortCode(ch.code)} · ${ch.name}` : (p.meta.chapter || 'Lesson');
  onTitle(title);
  const r = reads[chapterId];
  root.innerHTML = `<div class="stack lesson" style="gap:16px">
    <div class="row" style="gap:8px;flex-wrap:wrap"><span class="chip" style="--c:${m.color}"><span class="dot"></span><span class="txt">${esc(m.short)} · ${esc(shortCode(ch?.code || p.meta.code || ''))}</span></span>
      <span class="note num">≈ ${res.lesson.read_minutes || p.readMinutes} min read</span>
      ${r?.first_completed_at ? '<span class="note" style="color:var(--ok);font-weight:900">✓ Read</span>' : ''}
      ${res.offline ? '<span class="tdelta">Offline copy</span>' : ''}</div>
    ${p.greeting ? `<div class="row" style="align-items:flex-start;gap:12px"><div class="mascot" data-m="think"></div><div class="speech">${inline(p.greeting)}</div></div>` : ''}
    <div class="lbody">${renderSections(p)}</div>
    ${tocHTML(chapterId, lidx[chapterId]?.pages || [], r?.pages_read || [], inSheet)}
    ${p.quick.length ? `<div class="panel qc" id="qc-${chapterId}">
      <div class="eyebrow">Quick check · no XP, just you</div>
      ${r?.quick_check_total ? `<div class="note num" style="margin-top:4px">Last quick check ${r.quick_check_score}/${r.quick_check_total}</div>` : ''}
      ${p.quick.map((q, i) => `<div class="qcq" data-i="${i}"><div class="note num">${i + 1} / ${p.quick.length}</div><div class="qstem">${esc(q.stem)}</div>
        <div class="opts">${['A', 'B', 'C', 'D'].map((k, j) => `<button class="opt" data-k="${k}"><span class="k" aria-hidden="true">${k}</span><span class="grow">${esc(q.options[k])}</span></button>`).join('')}</div>
        <div class="qfb" hidden aria-live="polite"></div></div>`).join('')}
      <div class="qcdone" hidden></div>
    </div>` : ''}
    ${inSheet ? '<button class="btn block" data-close>Back to practice</button>' : `<button class="btn primary lg block" data-nav="#/pick/${chapterId}">Practice this chapter →</button>`}
  </div>`;
  $$('[data-m]', root).forEach(el => setMascot(el, el.dataset.m));

  // the reader may move on their own; after that we never scroll for them
  let userMoved = false;
  const scroller = root.closest('.scroll') || root;
  const moved = () => { userMoved = true; };
  ['wheel', 'touchstart', 'keydown', 'pointerdown'].forEach(ev => scroller.addEventListener(ev, moved, { once: true, passive: true }));

  // pictures: cached copies first, network otherwise (placeholders stay if both fail)
  if (p.images.length) lessonImages(res.lesson, p.images).then(async urls => {
    const loads = [];
    $$('.limg[data-img]', root).forEach(f => {
      const u = urls[f.dataset.img]; if (!u) return;
      const alt = f.querySelector('figcaption')?.textContent || '';
      const ph = f.querySelector('.ph'); if (!ph) return;
      const img = new Image(); img.alt = alt; img.src = u;
      loads.push(img.decode().catch(() => {}));
      ph.replaceWith(img);
    });
    // pictures above the anchor change the layout: land on the section again
    if (anchor && !userMoved) { await Promise.all(loads); if (!userMoved) jumpTo(root, anchor, false); }
  });

  bindQuickCheck(root, chapterId, p);
  // smooth scrolling would still be running when the pictures land, so jump instantly when there are pictures
  if (anchor) requestAnimationFrame(() => jumpTo(root, anchor, true, !p.images.length));
  return p;
}

function tocHTML(chapterId, pages, read, inSheet) {
  if (!pages.length) return '';
  return `<div class="panel toc"><div class="eyebrow">Read more · ${pages.length} pages</div>
    <div class="stack" style="gap:8px;margin-top:8px">${pages.map((pg, i) => `<button class="tocrow" ${inSheet ? `data-pg="${esc(pg.slug)}"` : `data-nav="#/lesson/${chapterId}/p/${esc(pg.slug)}"`}>
      <span class="n num">${i + 1}</span><span class="grow">${esc(pg.title)}</span>
      <span class="note num">${read.includes(pg.slug) ? '<span style="color:var(--ok);font-weight:900">✓</span> ' : ''}≈ ${pg.read_minutes || 5} min</span></button>`).join('')}</div></div>`;
}

/** Fill `root` with one reading page. opts: { inSheet, anchor, onTitle }. */
async function mountPage(root, chapterId, slug, { inSheet = false, anchor = null, onTitle = () => {} } = {}) {
  root.innerHTML = '<div class="loading" style="height:40vh"><div class="spin"></div></div>';
  let res, cat, lidx = {};
  try { [res, cat, lidx] = await Promise.all([loadPage(chapterId, slug), catalog().catch(() => null), lessonsMeta().catch(() => ({}))]); }
  catch (e) { root.innerHTML = `<div class="panel sunk empty">${esc(e.message)}</div>`; return null; }
  if (!res) { root.innerHTML = '<div class="panel sunk empty">This page is not published.</div>'; return null; }
  const ch = cat ? chapterIndex(cat)[chapterId] : null;
  const m = subjectMeta(ch?.subject);
  const pages = lidx[chapterId]?.pages || [];
  const i = pages.findIndex(pg => pg.slug === slug);
  const prev = i > 0 ? pages[i - 1] : null, next = i >= 0 && i < pages.length - 1 ? pages[i + 1] : null;
  const p = parseLesson(res.page.body_md, { page: true });
  onTitle(res.page.title);
  const link = (pg, label, cls = '') => pg === 'overview'
    ? `<button class="btn ${cls}" ${inSheet ? 'data-pg=""' : `data-nav="#/lesson/${chapterId}"`}>${label}</button>`
    : `<button class="btn ${cls}" ${inSheet ? `data-pg="${esc(pg.slug)}"` : `data-nav="#/lesson/${chapterId}/p/${esc(pg.slug)}"`}>${label}</button>`;
  root.innerHTML = `<div class="stack lesson" style="gap:16px">
    <div class="row" style="gap:8px;flex-wrap:wrap"><span class="chip" style="--c:${m.color}"><span class="dot"></span><span class="txt">${esc(m.short)} · ${esc(shortCode(ch?.code || ''))}</span></span>
      ${i >= 0 ? `<span class="note num">Page ${i + 1} of ${pages.length}</span>` : ''}<span class="note num">≈ ${res.page.read_minutes || p.readMinutes} min</span>
      ${res.offline ? '<span class="tdelta">Offline copy</span>' : ''}</div>
    <h2 class="ptitle">${inline(res.page.title)}</h2>
    <div class="lbody">${renderSections(p)}</div>
    <div class="pgnav">${prev ? link(prev, `‹ ${esc(prev.title)}`, 'ghost') : link('overview', '‹ Overview', 'ghost')}
      ${next ? link(next, `${esc(next.title)} ›`, 'primary') : link('overview', 'Quick check & practice ›', 'primary')}</div>
  </div>`;
  // the implicit first section repeats the page title: keep its anchor, drop the duplicate heading
  const first = root.querySelector('.lbody .lsec h3');
  if (first && first.textContent.trim() === root.querySelector('.ptitle').textContent.trim()) first.remove();
  markPage(chapterId, slug).then(() => { lessonsCache.at = 0; });
  if (anchor) requestAnimationFrame(() => jumpTo(root, anchor, true, true));
  return p;
}

function jumpTo(root, anchor, flash = true, smooth = false) {
  const el = root.querySelector(`[data-anchor="${CSS.escape(anchor)}"]`);
  if (!el) return;
  el.scrollIntoView({ behavior: smooth && !reducedMotion() ? 'smooth' : 'auto', block: 'start' });
  if (!flash) return;
  const h = el.matches('h4') ? el : el.querySelector('h3') || el;   // flash just the heading
  h.classList.remove('flash'); void h.offsetWidth; h.classList.add('flash');
}

function bindQuickCheck(root, chapterId, p) {
  const box = root.querySelector('.qc'); if (!box) return;
  const answers = new Array(p.quick.length).fill(null);
  let sent = false;
  box.addEventListener('click', async e => {
    const b = e.target.closest('.opt'); if (!b) return;
    const qEl = b.closest('.qcq'); const i = +qEl.dataset.i; if (answers[i] !== null) return;
    const q = p.quick[i]; const ok = b.dataset.k === q.answer;
    answers[i] = ok;
    $$('.opt', qEl).forEach(o => {
      o.disabled = true;
      if (o.dataset.k === q.answer) { o.classList.add('correct'); o.querySelector('.k').textContent = '✓'; }
      else if (o === b) { o.classList.add('wrong'); o.querySelector('.k').textContent = '✕'; }
      else o.classList.add('dim');
    });
    const fb = qEl.querySelector('.qfb');
    fb.innerHTML = `<b class="${ok ? 'ok' : 'bad'}">${ok ? 'Right.' : 'Not quite.'}</b> ${esc(q.explanation)}`; fb.hidden = false;
    if (answers.every(a => a !== null) && !sent) {
      sent = true;
      const score = answers.filter(Boolean).length, total = answers.length;
      const done = box.querySelector('.qcdone');
      done.hidden = false;
      done.innerHTML = `<div class="row between" style="margin-top:12px;gap:10px;flex-wrap:wrap"><b style="color:var(--ink);font-size:18px" class="num">${score}/${total} on the quick check</b><button class="btn ghost small" data-retry>Try again</button></div>`;
      done.querySelector('[data-retry]').onclick = () => {
        answers.fill(null); // a finished retry is saved again: lesson_reads keeps the latest quick check (FR-74)
        $$('.qcq', box).forEach(qEl2 => { qEl2.querySelector('.qfb').hidden = true; $$('.opt', qEl2).forEach((o, j) => { o.disabled = false; o.className = 'opt'; o.querySelector('.k').textContent = 'ABCD'[j]; }); });
        done.hidden = true; sent = false;
        box.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
      };
      try {
        const res = await completeLesson(chapterId, score, total);
        if (res?.xp_earned) toast(`Lesson complete · +${res.xp_earned} XP`, 2600);
        else toast('Saved.', 1400);
        lessonsCache.at = 0;
      } catch (ex) {
        toast(ex.code === 'network' ? "Offline — this quick check wasn't saved." : ex.message, 3000);
        sent = false;
      }
    }
  });
}

/* ---------------- full-screen lesson ---------------- */
export async function renderLesson(chapterId, a, b, c) {
  show('lesson');
  $('#lesson-back').onclick = () => { if (history.length > 1) history.back(); else navigate('#/learn'); };
  const scroller = $('#lesson-scroll');
  scroller.scrollTop = 0;
  $('#lesson-title').textContent = 'Lesson';
  const onTitle = t => { $('#lesson-title').textContent = t; };
  const dec = (x) => x ? decodeURIComponent(x) : null;
  if (a === 'p' && b) { await mountPage($('#lesson-body'), chapterId, dec(b), { anchor: dec(c), onTitle }); return; }
  // an anchor that lives on a page (e.g. a bookmarked Read link) goes to that page
  if (a) { try { const slug = pageForAnchor((await lessonsMeta())[chapterId], dec(a)); if (slug) { navigate(`#/lesson/${chapterId}/p/${encodeURIComponent(slug)}/${a}`, { replace: true }); return; } } catch { /* fall through */ } }
  await mountLesson($('#lesson-body'), chapterId, { anchor: dec(a), onTitle });
}

/* ---------------- bottom sheet over quiz / result ---------------- */
export function openLessonSheet(chapterId, anchor) {
  document.querySelector('.lsheet')?.remove();
  const wrap = document.createElement('div');
  wrap.className = 'lsheet';
  wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-modal', 'true'); wrap.setAttribute('aria-label', 'Lesson');
  wrap.innerHTML = `<div class="body"><div class="bar"><h2>Lesson</h2><button class="back" data-close aria-label="Close lesson">×</button></div><div class="scroll"></div></div>`;
  const prevFocus = document.activeElement;
  const close = () => { wrap.remove(); document.removeEventListener('keydown', onKey, true); prevFocus?.focus?.(); };
  const onKey = (e) => { if (e.key === 'Escape') { e.stopPropagation(); close(); } };
  wrap.addEventListener('click', e => { if (e.target === wrap || e.target.closest('[data-close]')) close(); });
  document.addEventListener('keydown', onKey, true);
  $('#app').appendChild(wrap);
  wrap.querySelector('[data-close]').focus();
  const sc = wrap.querySelector('.scroll');
  const onTitle = t => { wrap.querySelector('h2').textContent = t; };
  const open = (slug, a) => { sc.scrollTop = 0; return slug ? mountPage(sc, chapterId, slug, { inSheet: true, anchor: a, onTitle }) : mountLesson(sc, chapterId, { inSheet: true, anchor: a, onTitle }); };
  // links inside the sheet switch pages in place (the quiz underneath stays put)
  wrap.addEventListener('click', e => { const b = e.target.closest('[data-pg]'); if (b) { e.stopPropagation(); open(b.dataset.pg || null, null); } });
  lessonsMeta().catch(() => ({})).then(lidx => open(pageForAnchor(lidx[chapterId], anchor), anchor));
  return close;
}
