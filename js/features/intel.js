// v3.0.0 Boss Intel: the chapter lesson read as short swipe cards. Each NEW card (in order, passed with a 1-tap check)
// charges the chapter's Intel: 1 = Shield, 2 = Weak spot ×2, 3 = +20% XP. The next finished battle on that chapter uses it.
// #/intel/<chapterId>          → scout screen (monster, charge, buffs)
// #/intel/<chapterId>/read     → card deck
import { $, $$, esc, subjectMeta, shortCode, toast } from '../ui.js';
import { prefs } from '../store.js';
import { loadLesson, lessonImages, readIntelCard, intelCharges, checkQuestions, myLessonReads } from '../store.js';
import { parseLesson, renderSections } from '../lesson-md.js';
import { app, catalog, chapterIndex, viewerId } from '../state.js';
import { show, navigate } from '../router.js';
import { monsterSVG, phaseOf } from '../monsters.js';
import { bossState, rules, bossName } from '../dojo.js';

export const BUFFS = [
  { lvl: 1, ic: '🛡️', name: 'Shield', txt: "Your first wrong answer doesn't break your combo" },
  { lvl: 2, ic: '⚡', name: 'Weak spot ×2', txt: 'Every hit on this boss does double damage' },
  { lvl: 3, ic: '✨', name: '+20% XP', txt: 'Bonus XP when you finish the battle' },
];
const MAX = 3, BUDGET = 700;

/* ---------- lesson → cards ---------- */
const sizeOf = (b) => {
  switch (b.t) {
    case 'p': case 'nib': case 'trap': case 'catatan': return (b.text || '').length;
    case 'ul': case 'ol': return b.items.reduce((t, x) => t + x.length + 20, 0);
    case 'table': return [...(b.head || []), ...b.body.flat()].reduce((t, x) => t + String(x).length + 6, 0) + 30 * b.body.length;
    case 'img': return 260;
    case 'dalil': return ((b.arab || '') + (b.latin || '') + (b.arti || '')).length;
    case 'h3': return 40;
    default: return 60;
  }
};
/** Split the lesson into cards of about BUDGET characters, cutting at ### headings and between blocks (never inside one). */
export function buildCards(p) {
  const cards = [];
  for (const s of p.sections) {
    let cur = null, n = 0, part = 1, base = s.title;
    const open = (title) => { cur = { title, sec: s.title, anchors: [s.anchor].filter(Boolean), blocks: [] }; n = 0; };
    const push = () => {
      if (cur && cur.blocks.some(b => b.t !== 'h3')) {
        const last = cards[cards.length - 1];   // a tiny tail (e.g. one Trap box) joins the card before it
        if (n < 220 && last && last.sec === cur.sec && last.n + n <= 950) { last.blocks.push(...cur.blocks); last.n += n; cur.anchors.forEach(a => { if (!last.anchors.includes(a)) last.anchors.push(a); }); }
        else { cur.n = n; cards.push(cur); }
      }
      cur = null;
    };
    open(s.title);
    for (const b of s.blocks) {
      const sz = sizeOf(b);
      if (b.t === 'h3' && n > 80) { push(); base = b.title; part = 1; open(b.title); if (b.anchor) cur.anchors.unshift(b.anchor); continue; }
      if (n + sz > BUDGET && cur.blocks.some(x => x.t !== 'h3')) {
        const tail = cur.blocks[cur.blocks.length - 1];   // a short lead-in line ("**The method**") moves with what it introduces
        const carry = cur.blocks.length > 1 && tail.t === 'p' && tail.text.length < 90 ? cur.blocks.pop() : null;
        if (carry) n -= sizeOf(carry);
        push(); open(`${base} · part ${++part}`);
        if (carry) { cur.blocks.push(carry); n += sizeOf(carry); }
      }
      cur.blocks.push(b); n += sz;
      if (b.t === 'h3' && b.anchor) cur.anchors.unshift(b.anchor);
    }
    push();
  }
  return cards;
}

/* ---------- state ---------- */
let D = null;   // { ch, m, boss, cards, lesson, level, read, total, qs, used:Set, goal, done, preview }

async function load(chapterId) {
  const [cat, res, charges, reads] = await Promise.all([catalog(), loadLesson(chapterId), intelCharges(viewerId()).catch(() => ({})), myLessonReads(viewerId()).catch(() => ({}))]);
  const ch = chapterIndex(cat)[chapterId];
  if (!ch) throw new Error('Chapter not found.');
  const m = subjectMeta(ch.subject), st = cat.statBy[chapterId], R = rules(cat);
  let ph = st ? phaseOf(bossState(st, false, R), R) : 'new'; if (ph === 'new') ph = 'minion';
  const p = res ? parseLesson(res.lesson.body_md) : null;
  const cards = p ? buildCards(p) : [];
  return { ch, m, st, ph, boss: bossName(ch, m.key).name, lesson: res?.lesson || null, cards, level: charges[chapterId] || 0,
    read: reads[chapterId]?.cards_read || 0, total: cards.length, preview: !!app.viewAs || app.profile?.role === 'admin', qs: null, used: new Set(), done: 0 };
}

export async function renderIntel(chapterId, mode) {
  show('intel');
  const body = $('#intel-body');
  body.innerHTML = '<div class="loading" style="height:40vh"><div class="spin"></div></div>';
  try { D = await load(chapterId); } catch (e) { body.innerHTML = `<div class="nd-card">${esc(e.message)}</div>`; return; }
  if (mode === 'read' && D.cards.length) { D.goal = Math.max(1, MAX - D.level); startDeck(); return; }
  scout();
}

/* ---------- scout screen ---------- */
function scout() {
  const { ch, m, st, ph, boss, level, read, total, cards } = D;
  $('#intel-title').textContent = 'Scout the boss';
  $('#intel-back').onclick = () => { if (history.length > 1) history.back(); else navigate('#/learn'); };
  const pos = total ? (read % total) : 0, pass = total ? Math.floor(read / total) : 0;
  $('#intel-body').innerHTML = `<div class="nd-stack it">
    <div class="nd-card it-boss" style="--c:${m.color}">${monsterSVG(ch, { phase: ph, size: 150 })}
      <div class="nd-h2">${esc(boss)}</div><div class="nd-label">${esc(m.short)} ${esc(shortCode(ch.code))} · ${esc(ch.name)}${st?.answered ? ` · you: ${st.accuracy_recent}%` : ''}</div></div>
    ${cards.length ? `<div class="nd-card"><div class="row between"><div class="nd-label">Intel charged</div><span class="it-chip y num">${level} / ${MAX}</span></div>
      <div class="it-dots">${[1, 2, 3].map(i => `<i class="${i <= level ? 'on' : ''}"></i>`).join('')}</div>
      ${BUFFS.map(b => `<div class="it-buff ${b.lvl <= level ? '' : 'lock'}"><span class="ic">${b.ic}</span><div><b>${b.name}</b><span>${b.lvl <= level ? b.txt : `Read ${b.lvl} card${b.lvl > 1 ? 's' : ''} to unlock`}</span></div><span class="st">${b.lvl <= level ? '✓' : '🔒'}</span></div>`).join('')}
      <p class="nd-sub" style="font-size:12px;margin:10px 0 0">Intel is used up by your next finished battle on this chapter. Lesson progress: card <b class="num">${Math.min(pos + 1, total)}</b> of <span class="num">${total}</span>${pass ? ` · read ${pass}× already` : ''}.</p></div>
      <button class="nd-btn primary block lg" id="it-read">${level >= MAX ? '📜 Read more (Intel is full)' : `📜 Read intel · ${MAX - level} card${MAX - level > 1 ? 's' : ''} ≈ ${MAX - level} min`}</button>`
    : '<div class="nd-card"><p class="nd-sub">No lesson for this chapter yet, so there is no Intel to read.</p></div>'}
    <button class="nd-btn block" data-nav="#/pick/${ch.chapter_id}">${level ? `⚔️ Hunt with ${level}/${MAX} Intel →` : 'Hunt now without Intel →'}</button>
    ${cards.length ? `<button class="nd-link" data-nav="#/lesson/${ch.chapter_id}">Open the full lesson page ›</button>` : ''}
  </div>`;
  $('#it-read')?.addEventListener('click', () => { D.goal = Math.max(1, MAX - D.level); history.pushState(null, '', `#/intel/${ch.chapter_id}/read`); startDeck(); });
}

/* ---------- card deck ---------- */
function startDeck() {
  D.done = 0; D.tries = 0;
  $('#intel-back').onclick = () => { navigate(`#/intel/${D.ch.chapter_id}`, { replace: true }); };
  drawCard();
}
const cardIdx = () => D.read % D.total;

async function pickCheck(card) {
  if (!D.qs) { try { D.qs = await checkQuestions(D.ch.chapter_id); } catch { D.qs = []; } }
  const fresh = (q) => !D.used.has(q.id) && q.options && q.options[q.answer_key];
  const tiers = [D.qs.filter(q => card.anchors.includes(q.lesson_anchor)), D.qs.filter(q => q.is_quick_check), D.qs];
  for (const t of tiers) { const pool = t.filter(fresh); if (pool.length) { const q = pool[Math.floor(Math.random() * pool.length)]; D.used.add(q.id); return q; } }
  return null;
}

async function drawCard() {
  const card = D.cards[cardIdx()], n = cardIdx();
  $('#intel-title').textContent = `Intel · ${D.boss}`;
  const body = $('#intel-body');
  body.innerHTML = `<div class="nd-stack it">
    <div class="it-prog"><div class="it-dots">${Array.from({ length: D.goal }, (_, i) => `<i class="${i < D.done ? 'on' : ''}"></i>`).join('')}</div><span class="nd-label num">Card ${n + 1}/${D.total}</span></div>
    <article class="it-card" id="it-card">
      <div class="nd-label" style="color:#B9A6FF">${esc(D.m.short)} ${esc(shortCode(D.ch.code))} · ${esc(card.sec)}</div>
      <div class="lesson it-content">${renderSections({ sections: [{ title: card.title, anchor: card.anchors[0] || '', blocks: card.blocks }] })}</div>
      <div class="it-check" id="it-check"><div class="spin" style="width:22px;height:22px"></div></div>
    </article>
    <button class="nd-btn primary block lg" id="it-next" disabled>Answer the check to continue</button>
    ${D.preview ? '<p class="nd-sub" style="text-align:center;font-size:12px">Dad preview: cards are not counted.</p>' : ''}
  </div>`;
  body.closest('.scroll').scrollTop = 0;
  const imgs = card.blocks.filter(b => b.t === 'img').map(b => b.name);
  if (imgs.length && D.lesson) lessonImages(D.lesson, imgs).then(urls => $$('.limg[data-img]', body).forEach(f => {
    const u = urls[f.dataset.img], ph = f.querySelector('.ph'); if (!u || !ph) return;
    const img = new Image(); img.alt = f.querySelector('figcaption')?.textContent || ''; img.src = u; ph.replaceWith(img);
  })).catch(() => { /* placeholders stay */ });
  D.tries = 0;
  renderCheck(card, await pickCheck(card));
  bindSwipe(body);
}

function renderCheck(card, q) {
  const box = $('#it-check'); if (!box) return;
  if (!q) {   // no usable question: a short pause, then "Got it"
    box.innerHTML = '<div class="nd-label" style="color:var(--nd-ok)">Got it?</div><p class="nd-sub" style="margin:4px 0 0">Read the card, then continue.</p>';
    setTimeout(() => { const b = $('#it-next'); if (b) { b.disabled = false; b.textContent = 'Got it → next card'; b.onclick = () => passCard(true); } }, 6000);
    return;
  }
  const keys = Object.keys(q.options).filter(k => q.options[k]).sort(() => Math.random() - 0.5);
  box.innerHTML = `<div class="nd-label" style="color:var(--nd-ok)">Tap-check${D.tries ? ' · second try' : ''}</div>
    <div class="it-q">${esc(q.stem)}</div>
    <div class="it-opts">${keys.map(k => `<button class="it-opt" data-k="${k}">${esc(q.options[k])}</button>`).join('')}</div>
    <div class="it-fb" hidden></div>`;
  $$('.it-opt', box).forEach(b => b.onclick = () => {
    const ok = b.dataset.k === q.answer_key;
    $$('.it-opt', box).forEach(x => { x.disabled = true; if (x.dataset.k === q.answer_key) x.classList.add('right'); else if (x === b) x.classList.add('wrong'); });
    const fb = $('.it-fb', box); fb.hidden = false;
    const nx = $('#it-next');
    if (ok) {
      fb.innerHTML = `<b class="ok">Right!</b> ${esc(q.explanation || '')}`;
      nx.disabled = false; nx.textContent = D.done + 1 >= D.goal ? 'Charge Intel ⚡' : 'Next card →'; nx.onclick = () => passCard(true);
      try { navigator.vibrate?.(30); } catch { /* iOS */ }
    } else if (D.tries === 0) {
      fb.innerHTML = `<b class="bad">Not quite.</b> ${esc(q.explanation || '')}<br><span class="nd-sub">Read the card again, then try a new check.</span>`;
      nx.disabled = false; nx.textContent = 'Try a new check'; nx.onclick = async () => { D.tries = 1; nx.disabled = true; nx.textContent = 'Answer the check to continue'; renderCheck(card, await pickCheck(card)); };
    } else {
      fb.innerHTML = `<b class="bad">Still tricky.</b> ${esc(q.explanation || '')}<br><span class="nd-sub">It counts. Remember this one for the battle!</span>`;
      nx.disabled = false; nx.textContent = 'Next card →'; nx.onclick = () => passCard(false);
    }
  });
}

async function passCard(correct) {
  const nx = $('#it-next'); if (nx) { nx.disabled = true; nx.textContent = 'Saving…'; }
  const before = D.level;
  if (!D.preview) {
    try {
      const r = await readIntelCard(D.ch.chapter_id, cardIdx(), D.total, correct);
      D.read = r.cards_read; D.level = r.level;
      if (r.lesson_done) toast(`📖 Whole lesson read!${r.xp_earned ? ` +${r.xp_earned} XP` : ''}`, 2600);
    } catch (e) { toast(e.message, 3000); if (nx) { nx.disabled = false; nx.textContent = 'Try again'; } return; }
  } else { D.read += 1; D.level = Math.min(MAX, D.level + 1); }
  D.done += 1;
  const gained = BUFFS.find(b => b.lvl === D.level && D.level > before);
  if (gained) toast(`${gained.ic} Intel +1 · ${gained.name} unlocked!`, 2000);
  if (D.done >= D.goal) { charged(); return; }
  const card = $('#it-card'); card?.classList.add('out');
  setTimeout(drawCard, 220);
}

function charged() {
  const { ch, level } = D;
  $('#intel-body').innerHTML = `<div class="nd-stack it" style="text-align:center">
    <div class="nd-card it-boss">${monsterSVG(ch, { phase: D.ph, size: 140 })}<div class="it-big">INTEL ${level >= MAX ? 'FULL' : 'CHARGED'}!</div>
      <div class="it-dots" style="justify-content:center;max-width:180px;margin:10px auto">${[1, 2, 3].map(i => `<i class="${i <= level ? 'on' : ''}"></i>`).join('')}</div>
      <div class="it-buffs">${BUFFS.filter(b => b.lvl <= level).map(b => `<span class="it-chip g">${b.ic} ${b.name}</span>`).join('')}</div>
      <p class="nd-sub" style="margin:8px 0 0">${esc(D.boss)} has no secrets now. Strike while it lasts!</p></div>
    <button class="nd-btn primary block lg" data-nav="${(prefs.get('lastChapters', []) || []).includes(ch.chapter_id) ? '#/pick' : `#/pick/${ch.chapter_id}`}">⚔️ Hunt ${esc(D.boss)} →</button>
    <button class="nd-btn block" id="it-more">📜 Read one more card</button>
  </div>`;
  $('#it-more').onclick = () => { D.goal = 1; D.done = 0; drawCard(); };
}

function bindSwipe(el) {
  let x0 = null;
  el.ontouchstart = (e) => { x0 = e.touches[0].clientX; };
  el.ontouchend = (e) => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; const nx = $('#it-next'); if (dx < -70 && nx && !nx.disabled && /Next|Charge|Got it/.test(nx.textContent)) nx.click(); };
}
