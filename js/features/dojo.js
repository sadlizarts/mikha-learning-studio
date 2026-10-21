// Dojo screen (v1.8.0): rank + rank exam, today's Ki (daily target / XP cap), streak shield, bosses per chapter, technique cards.
import { $, $$, esc, subjectMeta, shortCode, sheet, toast, jakartaDate, shortDay } from '../ui.js';
import { loadProgress, progressOf, loadDojo, startAttempt, startRankExam } from '../store.js';
import { app, catalog, chapterIndex, viewerId } from '../state.js';
import { show, navigate } from '../router.js';
import { RANKS, rules, bossName, techName, bossState, bossSVG, cardSVG, beltSVG, cardTier, TIER_LABEL, rankInfo } from '../dojo.js';

let filter = 'all';

const STATUS = {
  new: ['Not met yet', 'var(--ink-3)'], fight: ['Fighting', 'var(--ember)'], defeated: ['Sealed', 'var(--ok)'],
  cracked: ['Seal cracking', 'var(--volt-2)'], revived: ['Came back!', 'var(--bad)'],
};

/** Pure: bosses, rank and exam state from data the screens already loaded. */
export function dojoFrom(cat, prog, dj, viewing = !!app.viewAs) {
  const R = rules(cat), idx = chapterIndex(cat);
  const used = new Set(), usedT = new Set();
  const bosses = [...cat.chapters].sort((a, b) => String(a.code).localeCompare(String(b.code))).map(c => {
    const ch = idx[c.chapter_id], m = subjectMeta(ch.subject);
    const st = bossState(cat.statBy[c.chapter_id], !!dj.beaten[c.chapter_id], R);
    let nm = bossName(ch, m.key), i = 0;
    while (used.has(nm.name) && i < 20) nm = bossName(ch, m.key, '#' + (++i));
    used.add(nm.name);
    let tech = techName(ch), j = 0;
    while (usedT.has(tech) && j < 20) tech = techName(ch, '#' + (++j));
    usedT.add(tech);
    return { ch, m, st, beaten: dj.beaten[c.chapter_id] || null, ...nm, tech };
  });
  const order = Object.fromEntries(cat.chapters.map((c, i) => [c.chapter_id, i]));
  bosses.sort((a, b) => order[a.ch.chapter_id] - order[b.ch.chapter_id]);
  const beatNow = bosses.filter(b => b.st.beatNow).length;
  const rk = rankInfo(prog?.rank || 0, beatNow, R);
  const today = jakartaDate();
  const triedToday = (dj.exams || []).some(e => e.rank === rk.rank + 1 && jakartaDate(e.taken_at) === today);
  return { cat, prog, dj, R, idx, bosses, beatNow, rk, triedToday, viewing };
}

export async function dojoData(force = false) {
  const vid = viewerId(), viewing = !!app.viewAs;
  const [cat, prog, dj] = await Promise.all([catalog(force), viewing ? progressOf(vid) : loadProgress(), loadDojo(vid)]);
  return dojoFrom(cat, prog, dj, viewing);
}

export function kiPanel(prog, R, { compact = false } = {}) {
  const n = prog?.answers_today || 0;
  const pct = Math.min(100, Math.round(100 * n / R.target));
  const capped = n >= R.cap;
  const msg = capped ? `XP cap reached (${R.cap} answers). Great work, rest now — more practice still trains your bosses, but gives no XP today.`
    : n >= R.target ? `Mission done! XP keeps coming until ${R.cap} answers today.`
    : `${R.target - n} more answers to finish today's mission.`;
  return `<div class="panel ki ${capped ? 'capped' : n >= R.target ? 'done' : ''}">
    <div class="row between"><div class="eyebrow">Today's Ki</div><span class="note num">${n}/${R.target}</span></div>
    <div class="kibar" role="progressbar" aria-valuemin="0" aria-valuemax="${R.target}" aria-valuenow="${Math.min(n, R.target)}" aria-label="Answers today"><i style="--p:${pct}%"></i></div>
    ${compact ? '' : `<p class="note" style="margin-top:6px">${esc(msg)}</p>`}
  </div>`;
}

export function rankPanel(d, { compact = false } = {}) {
  const { rk, R, viewing, triedToday } = d;
  const nextLine = rk.next
    ? (rk.ready ? `Exam for <b>${esc(rk.next.name)}</b> is open: 30 questions from your sealed bosses, pass ≥ ${R.pass}%.`
      : `Seal <b class="num">${rk.need - rk.have}</b> more boss${rk.need - rk.have === 1 ? '' : 'es'} to unlock the <b>${esc(rk.next.name)}</b> exam.`)
    : 'Top rank. Keep every seal strong!';
  const bar = rk.next ? `<div class="kibar rankbar"><i style="--p:${Math.min(100, Math.round(100 * rk.have / rk.need))}%"></i></div><div class="note num" style="margin-top:4px">${rk.have}/${rk.need} bosses sealed</div>` : '';
  const btn = !viewing && rk.ready ? (triedToday ? '<p class="note" style="margin-top:8px">You tried the exam today. Train and try again tomorrow!</p>'
    : `<button class="btn primary block" style="margin-top:10px" id="exambtn">Take the rank exam →</button>`) : '';
  return `<div class="panel rankcard" style="--belt:${rk.color}">
    <div class="row" style="gap:14px;align-items:center">
      <div class="beltwrap">${beltSVG(rk.color, compact ? 54 : 72)}</div>
      <div class="grow"><div class="eyebrow">Dojo rank · ${esc(rk.belt)}</div><div class="rankname">${esc(rk.name)}</div></div>
    </div>
    ${compact ? '' : `<p class="note" style="margin-top:8px;font-size:14px">${nextLine}</p>`}${bar}${compact ? (rk.ready && !viewing && !triedToday ? '<button class="btn small primary" style="margin-top:8px" data-nav="#/dojo">Exam open →</button>' : '') : btn}
  </div>`;
}

export function bossTile(b, { small = false } = {}) {
  const [lbl, col] = STATUS[b.st.status];
  const art = b.st.status === 'defeated' ? 'defeated' : b.st.status === 'new' ? 'new' : 'fight';
  return `<button class="boss ${esc(b.st.status)}${small ? ' small' : ''}" data-boss="${b.ch.chapter_id}" style="--c:${b.m.color}">
    <div class="art">${bossSVG(b.ch, b.m.color, { state: art, size: small ? 64 : 84 })}</div>
    <div class="bname">${esc(b.name)}</div>
    <div class="note btitle">${esc(b.title)} · ${esc(b.m.short)} ${esc(shortCode(b.ch.code))}</div>
    <div class="hp" role="img" aria-label="Boss HP ${b.st.hp}%"><i style="--p:${b.st.hp}%"></i></div>
    <span class="chip" style="--c:${col}"><span class="dot"></span>${lbl}</span>
  </button>`;
}

async function fight(chapterId, btn) {
  if (btn) { btn.disabled = true; btn.textContent = 'Summoning…'; }
  try { const d = await startAttempt([chapterId], 30); navigate(`#/quiz/${d.attempt.id}`); }
  catch (e) {
    toast(e.code === 'in_progress' ? 'Finish or leave your other practice first (see Home).' : e.message, 3500);
    if (btn) { btn.disabled = false; btn.textContent = 'Fight (30 questions) →'; }
  }
}

export function openBoss(b, viewing) {
  const s = b.st, [lbl] = STATUS[s.status];
  const why = s.status === 'new' ? 'You have not fought this spirit yet.'
    : s.status === 'defeated' ? `Sealed! Keep your last-30 accuracy at ${'≥'} 80% to keep it sealed.`
    : s.status === 'revived' ? 'It broke out of its seal (accuracy fell below 70%). Seal it again!'
    : s.status === 'cracked' ? 'The seal is cracking (accuracy under 80%). A practice will fix it.'
    : 'Get at least 15 answers and 80% on the last 30 to seal it.';
  const card = b.beaten ? `<div class="row" style="gap:12px;margin-top:12px;align-items:center">${cardSVG(b.ch, b.m.color, cardTier(b.beaten.best_accuracy), { size: 64 })}
      <div><div class="eyebrow">Technique card</div><b>${esc(b.tech)}</b><div class="note">${TIER_LABEL[cardTier(b.beaten.best_accuracy)]} · best ${b.beaten.best_accuracy}% · since ${esc(shortDay(b.beaten.first_defeated_at))}</div></div></div>` : '';
  const body = `<div style="text-align:center">${bossSVG(b.ch, b.m.color, { state: s.status === 'defeated' ? 'defeated' : s.status === 'new' ? 'new' : 'fight', size: 120 })}</div>
    <p class="note" style="text-align:center;margin:4px 0 10px">${esc(b.title)} · guards <b>${esc(b.m.short)} ${esc(shortCode(b.ch.code))} ${esc(b.ch.name)}</b></p>
    <div class="hp big"><i style="--p:${s.hp}%"></i></div>
    <div class="row between note num" style="margin-top:4px"><span>HP ${s.hp}%</span><span>${s.n ? `last 30: ${s.acc}% · ${s.n} answers` : 'no answers yet'}</span></div>
    <p style="margin-top:10px"><b>${esc(lbl)}</b> · ${esc(why)}</p>${card}`;
  const actions = viewing ? [{ label: 'Close', value: false }] : [{ label: 'Close', value: false }, { label: 'Fight (30 questions) →', value: true, cls: 'primary' }];
  return sheet({ title: b.name, body, actions }).then(go => { if (go) fight(b.ch.chapter_id); });
}

export async function renderDojo() {
  show('dojo');
  const body = $('#dojo-body');
  if (!body.dataset.ready) body.innerHTML = '<div class="loading" style="height:50vh"><div class="spin"></div></div>';
  let d;
  try { d = await dojoData(true); } catch (e) { body.innerHTML = `<div class="panel sunk empty">${esc(e.message)}</div>`; return; }
  const { cat, bosses, R, prog, viewing } = d;
  const subs = cat.subjects.map(s => subjectMeta(s));
  const shown = bosses.filter(b => filter === 'all' || b.m.key === filter);
  const order = { revived: 0, cracked: 1, fight: 2, new: 3, defeated: 4 };
  shown.sort((a, b) => order[a.st.status] - order[b.st.status] || a.st.hp - b.st.hp);
  const owned = bosses.filter(b => b.beaten);
  const shield = prog?.freeze_ready ? (prog?.freeze_needed ? '🛡️ Streak shield is protecting your streak today. Practise to keep it!' : '🛡️ Streak shield ready: miss one day and your streak survives (1× per week).')
    : '🛡️ Streak shield used this week. It recharges 7 days after use.';

  body.innerHTML = `<div class="stack">
    <div class="row between"><h1 style="font-size:34px">Dojo</h1>${viewing ? '<span class="note">Dad\'s view</span>' : ''}</div>
    <div class="dgrid">
      ${rankPanel(d)}
      <div class="stack" style="gap:14px">${kiPanel(prog, R)}<div class="panel sunk note" style="font-size:14px">${shield}</div></div>
    </div>
    <div>
      <div class="row between" style="margin-bottom:8px;flex-wrap:wrap;gap:8px"><h3 style="font-size:22px">Bosses <span class="note num">${d.beatNow}/${bosses.length} sealed</span></h3></div>
      <div class="chips" role="tablist">${[['all', 'All', 'var(--ink)'], ...subs.map(m => [m.key, m.short, m.color])].map(([k, l, c]) => `<button class="fchip ${k === filter ? 'on' : ''}" data-f="${k}" style="--c:${c}">${esc(l)}</button>`).join('')}</div>
      <div class="bossgrid">${shown.map(b => bossTile(b)).join('')}</div>
    </div>
    <div>
      <h3 style="font-size:22px;margin-bottom:8px">Technique cards <span class="note num">${owned.length}/${bosses.length}</span></h3>
      <p class="note" style="margin:-4px 0 10px">Seal a boss to earn its card. Bronze from 80%, Silver from 90%, Gold from 95% (best accuracy).</p>
      <div class="cardgrid">${bosses.map(b => b.beaten
        ? `<div class="tcard ${cardTier(b.beaten.best_accuracy)}" style="--c:${b.m.color}">${cardSVG(b.ch, b.m.color, cardTier(b.beaten.best_accuracy), { size: 88 })}<b>${esc(b.tech)}</b><span class="note">${esc(b.m.short)} ${esc(shortCode(b.ch.code))} · ${TIER_LABEL[cardTier(b.beaten.best_accuracy)]}</span></div>`
        : `<div class="tcard locked">${cardSVG(b.ch, b.m.color, 'bronze', { locked: true, size: 88 })}<b>???</b><span class="note">${esc(b.m.short)} ${esc(shortCode(b.ch.code))}</span></div>`).join('')}</div>
    </div>
  </div>`;
  body.dataset.ready = '1';

  $$('[data-f]', body).forEach(b => b.onclick = () => { filter = b.dataset.f; renderDojo(); });
  $$('[data-boss]', body).forEach(el => el.onclick = () => openBoss(bosses.find(b => b.ch.chapter_id === el.dataset.boss), viewing));
  const eb = $('#exambtn');
  if (eb) eb.onclick = async () => {
    const ok = await sheet({ title: `Rank exam · ${d.rk.next.name}`, body: `<p>30 questions mixed from your <b>${d.beatNow}</b> sealed bosses. Pass with <b>${R.pass}%</b> or more to become <b>${esc(d.rk.next.name)}</b> (${esc(d.rk.next.belt)}).</p><p class="note" style="margin-top:8px">One try per day. Hints are allowed. If you leave halfway, today's try is used.</p>`,
      actions: [{ label: 'Not yet', value: false }, { label: 'Start exam →', value: true, cls: 'primary' }] });
    if (!ok) return;
    eb.disabled = true; eb.textContent = 'Preparing the exam…';
    try { const a = await startRankExam(); navigate(`#/quiz/${a.attempt.id}`); }
    catch (e) { toast(e.code === 'in_progress' ? 'Finish or leave your other practice first (see Home).' : e.message, 4000); eb.disabled = false; eb.textContent = 'Take the rank exam →'; }
  };
}

export { RANKS };

/** Home tile: rank, today's Ki and the boss to fight next. */
export function homeDojo(d) {
  const { rk, R, prog, bosses, viewing, triedToday } = d;
  const n = prog?.answers_today || 0;
  const pr = { revived: 0, cracked: 1, fight: 2 };
  const next = bosses.filter(b => b.st.status in pr).sort((a, b) => pr[a.st.status] - pr[b.st.status] || a.st.hp - b.st.hp)[0];
  const kiPct = Math.min(100, Math.round(100 * n / R.target));
  return `<div class="panel dojomini" style="--belt:${rk.color}">
    <button class="row dmhead" data-nav="#/dojo" style="gap:12px;align-items:center;width:100%;text-align:left">
      ${beltSVG(rk.color, 52)}
      <div class="grow"><div class="eyebrow">Dojo · ${esc(rk.belt)}</div><div class="rankname" style="font-size:22px">${esc(rk.name)}</div></div>
      <span class="note num">${d.beatNow}/${bosses.length} sealed ›</span>
    </button>
    <div class="row between" style="margin-top:10px"><span class="eyebrow">Today's Ki</span><span class="note num">${n}/${R.target}${n >= R.cap ? ' · XP cap reached' : n >= R.target ? ' · mission done ✓' : ''}</span></div>
    <div class="kibar ${n >= R.cap ? 'capped' : ''}"><i style="--p:${kiPct}%"></i></div>
    ${rk.ready && !viewing && !triedToday ? `<button class="btn volt block small" style="margin-top:10px" data-nav="#/dojo">🥋 Rank exam for ${esc(rk.next.name)} is open →</button>` : ''}
    ${next ? `<div class="nextboss" data-boss="${next.ch.chapter_id}" style="--c:${next.m.color}">
      ${bossSVG(next.ch, next.m.color, { state: 'fight', size: 48 })}
      <div class="grow"><div style="font-weight:900;color:var(--ink)">${next.st.status === 'revived' ? 'Came back: ' : 'Next boss: '}${esc(next.name)}</div>
      <div class="note">${esc(next.m.short)} ${esc(shortCode(next.ch.code))} · HP ${next.st.hp}%</div>
      <div class="hp"><i style="--p:${next.st.hp}%"></i></div></div>
      ${viewing ? '' : '<button class="btn small primary" data-fight>Fight</button>'}</div>` : ''}
  </div>`;
}

export function bindHomeDojo(root, d) {
  const nb = root.querySelector('.nextboss');
  if (!nb) return;
  const b = d.bosses.find(x => x.ch.chapter_id === nb.dataset.boss);
  nb.onclick = (e) => { if (e.target.closest('[data-fight]')) fight(b.ch.chapter_id, e.target.closest('[data-fight]')); else openBoss(b, d.viewing); };
}
