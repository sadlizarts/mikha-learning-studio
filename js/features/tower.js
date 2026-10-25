// v3.5.0 Survival Tower: one subject, random questions from every chapter, 3 lives, a floor boss every 10 floors.
// Every answer, skill, life and chest is decided on the server (tower_* RPCs); this screen only shows the fight.
// Views: lobby (subject, record, loadout) → run (arena + question) → over (record, loot). #/tower
import { $, $$, esc, rich, toast, sheet, subjectMeta, shortCode, fmtNum, reducedMotion } from '../ui.js';
import { towerLobby, towerStart, towerResume, towerSkill, towerAnswer, towerEnd, imageUrl, loadHero, cosmetics } from '../store.js';
import { app, viewerId } from '../state.js';
import { show, navigate } from '../router.js';
import { dojoData } from './dojo.js';
import { cardTier } from '../dojo.js';
import { FAMILIES, monsterSrc, familyOf } from '../monsters.js';
import { STAGE_ART, itemArt, svgDoc } from '../hero/art.js';
import { AURAS, inventory, heroContext, validEquip, itemView } from '../hero/items.js';
import { heroPower, powerOf, STARS } from '../hero/iteminfo.js';
import { sfx, muted, setMuted } from '../sfx.js';

const SK = {
  focus: { ic: '🔍', name: 'Focus', help: 'Shows the method hint for this question.' },
  insight: { ic: '💡', name: 'Insight', help: 'Shows the method hint and the first step.' },
  cut: { ic: '✂️', name: 'Cut', help: 'Removes 2 wrong answers.' },
  guard: { ic: '🛡️', name: 'Guard', help: 'Your next wrong answer costs no life.' },
};
const TIER_SKILL = { bronze: 'insight', silver: 'cut', gold: 'guard' };
const CHEST_AT = (f) => f >= 50 ? ['Legendary', '#FF8A3D'] : f >= 40 ? ['Epic+', '#B9A6FF'] : f >= 30 ? ['Epic', '#B9A6FF'] : f >= 20 ? ['Rare+', '#5FA8FF'] : ['Rare', '#5FA8FF'];
const RCOL = { common: '#B8C2D0', rare: '#5FA8FF', epic: '#B9A6FF', legendary: '#FF8A3D' };
const OK_WORDS = ['K.O.!', 'FINISH!', 'K.O.!', 'CLEAN HIT!'];

let T = null;   // screen state

export async function renderTower() {
  show('tower');
  const body = $('#tower-body');
  if (T?.view === 'run' && T.run) { drawRun(); return; }
  body.innerHTML = '<div class="loading" style="height:60vh"><div class="spin"></div></div>';
  try {
    const vid = viewerId();
    const [d, lobby, hp, cos] = await Promise.all([dojoData(), towerLobby(app.viewAs ? vid : null), loadHero(vid).catch(() => ({ equipped: {} })),
      cosmetics(vid).catch(() => ({ items: [], owned: new Set(), shards: 0 }))]);
    const ctx = heroContext(d); ctx.cosmetics = cos.owned;
    const inv = inventory(ctx), eq = validEquip(hp.equipped, inv, ctx);
    const subs = d.cat.subjects.filter(s => d.bosses.some(b => b.ch.subject_id === s.id));
    const prev = T;
    T = { view: 'lobby', d, lobby, inv, eq, power: heroPower(eq, inv), subs, viewing: !!app.viewAs,
      subj: prev?.subj && subs.some(s => s.id === prev.subj) ? prev.subj : (lastSubject(lobby, subs) || subs[0]?.id), cards: new Set(prev?.cards || []) };
  } catch (e) { body.innerHTML = `<div class="nd-card" style="margin:16px">${esc(e.message)}</div>`; return; }
  drawLobby();
}

function lastSubject(lobby, subs) {
  const l = (lobby.subjects || []).filter(s => s.last && subs.some(x => x.id === s.subject_id)).sort((a, b) => new Date(b.last) - new Date(a.last))[0];
  return l?.subject_id;
}
const subOf = (id) => T.d.cat.subjects.find(s => s.id === id);
const famOfSub = (id) => subjectMeta(subOf(id)).key;
const bossBy = (cid) => T.d.bosses.find(b => b.ch.chapter_id === cid || b.ch.id === cid);
const recOf = (id) => (T.lobby.subjects || []).find(s => s.subject_id === id) || { best: 0, runs: 0 };

/* ------------------------------------------------------------------ lobby */
function cardsFor(sid) {
  return T.d.bosses.filter(b => b.ch.subject_id === sid && b.beaten).map(b => {
    const tier = cardTier(b.beaten.best_accuracy);
    return { id: b.ch.chapter_id, b, tier, skill: TIER_SKILL[tier] };
  });
}
function gearChips(g) {
  if (!g) return '';
  const w = g.cut && g.guard ? '⚔️ +1 Guard +1 Cut' : g.guard ? '⚔️ +1 Guard' : g.cut ? '⚔️ +1 Cut' : g.focus ? '⚔️ +1 Focus' : '⚔️ no weapon bonus';
  return `<span class="tchip ${g.cut || g.guard || g.focus ? 'g' : ''}">${w}</span>
    <span class="tchip ${g.last_stand ? 'r' : ''}">${g.last_stand ? '❤️ Last Stand' : '🛡️ no Last Stand'}</span>
    <span class="tchip ${g.xp ? 'y' : ''}">💍 +${g.xp || 0}% XP</span>
    <span class="tchip ${g.luck ? 'v' : ''}">🍀 +${g.luck || 0}% chest luck</span>`;
}

function drawLobby() {
  const { subj, lobby, subs, viewing } = T;
  const s = subOf(subj), m = subjectMeta(s), fam = m.key, rec = recOf(subj);
  const cards = cardsFor(subj);
  for (const c of [...T.cards]) if (!cards.some(x => x.id === c)) T.cards.delete(c);
  if (!T.cards.size && !T.touched) cards.sort((a, b) => b.b.beaten.best_accuracy - a.b.beaten.best_accuracy).slice(0, 3).forEach(c => T.cards.add(c.id));
  const g = lobby.gear?.[subj];
  const chs = T.d.bosses.filter(b => b.ch.subject_id === subj).length;
  const nextBoss = (Math.floor(rec.best / 10) + 1) * 10;
  const left = lobby.reward_runs_left;
  const open = lobby.open_run;
  const weaponSk = g ? [...Array(g.focus || 0).fill('focus'), ...Array(g.cut || 0).fill('cut'), ...Array(g.guard || 0).fill('guard')] : [];
  $('#tower-body').innerHTML = `<div class="tw-wrap" style="--sc:${FAMILIES[fam].c}">
    <span class="tw-kanji" aria-hidden="true">塔</span>
    <div class="row between"><div><button class="nd-link" data-nav="#/dojo">‹ Dojo</button><div class="nd-label">${viewing ? 'Dad\'s view · read-only' : 'Survival mode'}</div><div class="nd-h1">Survival Tower</div></div>
      <button class="back mute tw-mute" id="twmute" aria-label="${muted() ? 'Sound off' : 'Sound on'}">${muted() ? '🔇' : '🔊'}</button></div>
    <div class="tw-subs" role="tablist">${subs.map(x => { const mm = subjectMeta(x), r = recOf(x.id);
      return `<button role="tab" class="${x.id === subj ? 'on' : ''}" style="--c:${FAMILIES[mm.key].c}" data-sub="${x.id}">${esc(mm.short)}${r.best ? `<i>${r.best}</i>` : ''}</button>`; }).join('')}</div>
    <div class="tw-tower">
      <div class="tw-col" aria-hidden="true"><i style="top:30%"></i><i style="top:46%"></i><i style="top:62%"></i><i style="top:78%"></i></div>
      <img class="tw-top" src="${monsterSrc(fam, 'exam')}" alt="" decoding="async">
      <div class="tw-l"><div class="nd-label">Best</div><div class="tw-big">${rec.best ? `Floor ${rec.best}` : '—'}</div><div class="tw-mini">${rec.best ? `Next boss: Floor ${nextBoss}` : 'First climb!'}</div></div>
      <div class="tw-r"><div class="nd-label">Reward runs</div><div class="tw-big">${left}<small>/2</small></div><div class="tw-mini">${left ? 'left today' : 'records + XP only'}</div></div>
    </div>
    <div class="nd-card tw-hp"><img src="${STAGE_ART(T.d.rk.rank)}" alt="" decoding="async"><div class="grow" style="min-width:0">
      <div class="row between"><div class="nd-label">Hero Power</div><button class="tw-pow num" data-nav="#/hero" title="Change gear">⚡${T.power}</button></div>
      <div class="tchips">${gearChips(g)}</div></div></div>
    <div class="row between"><div class="nd-label">Bring up to 3 technique cards</div><span class="nd-label" style="color:var(--nd-gold)">${T.cards.size}/3</span></div>
    <div class="tw-load">
      <div class="tsk base"><span class="ic">🔍</span><b>Focus</b><span>free</span></div>
      ${cards.map(c => { const on = T.cards.has(c.id);
        return `<button class="tsk ${on ? 'on' : ''} t-${c.tier}" data-card="${c.id}" ${viewing ? 'disabled' : ''} aria-pressed="${on}"><span class="ic">${SK[c.skill].ic}</span><b>${esc(c.b.tech)}</b><span>${esc(shortCode(c.b.ch.code))} · ${SK[c.skill].name}</span></button>`; }).join('')}
      ${weaponSk.map(k => `<div class="tsk wpn"><span class="ic">${SK[k].ic}</span><b>${SK[k].name}</b><span>weapon</span></div>`).join('')}
    </div>
    <p class="tw-note">${cards.length ? '' : `No ${esc(m.short)} cards yet: seal ${esc(m.short)} bosses to earn them. `}Bronze card = 💡 Insight · Silver 90%+ = ✂️ Cut · Gold 95%+ = 🛡️ Guard. Each skill works once per run.</p>
    ${viewing ? '' : open ? `<button class="nd-btn primary block lg" id="twgo" data-resume="${open}">▶ Continue your climb</button><button class="nd-btn block" id="twnew">Start a new run</button>`
      : `<button class="nd-btn primary block lg" id="twgo">⚔️ Enter the ${esc(m.short)} Tower</button>`}
    <p class="tw-note" style="text-align:center">3 lives · no timer · questions from all ${chs} ${esc(m.short)} chapters · a floor boss every 10 floors${left ? '' : '<br>Today\'s 2 reward runs are used: this climb counts for your record and XP, chests come back tomorrow.'}</p>
    <div class="nd-card tw-recs"><div class="nd-label">Your records</div><div class="tw-recgrid">${subs.map(x => { const r = recOf(x.id);
      return `<span><b>${esc(subjectMeta(x).short)}</b><i>${r.best ? `Floor ${r.best}` : '—'}</i></span>`; }).join('')}</div></div>
    <div class="nd-card tw-rules"><div class="nd-label">Floor chests</div><div class="tw-chests">${[10, 20, 30, 40, 50].map(f => { const [n, c] = CHEST_AT(f);
      return `<span style="--c:${c}"><b>${f}${f === 50 ? '+' : ''}</b><i>${n}</i></span>`; }).join('')}</div>
      <p class="tw-note" style="margin-top:8px">Beat the floor boss (always a hard question) to open its chest. Wrong answers go to Revenge. Leaving keeps what you won, with no Retreat cost. The Tower never changes your boss accuracy or belt.</p></div>
  </div>`;
  $$('[data-sub]').forEach(b => b.onclick = () => { T.subj = b.dataset.sub; T.cards = new Set(); T.touched = false; sfx.tap(); drawLobby(); });
  $$('[data-card]').forEach(b => b.onclick = () => {
    const id = b.dataset.card; T.touched = true;
    if (T.cards.has(id)) T.cards.delete(id); else if (T.cards.size >= 3) { toast('Pick at most 3 cards. Tap one to put it back.', 2200); return; } else T.cards.add(id);
    sfx.tap(); drawLobby();
  });
  $('#twmute').onclick = () => { setMuted(!muted()); drawLobby(); };
  const go = $('#twgo');
  if (go) go.onclick = () => go.dataset.resume ? resume(go.dataset.resume) : start();
  const nw = $('#twnew');
  if (nw) nw.onclick = async () => {
    const v = await sheet({ title: 'Start a new run?', body: 'Your open climb ends where it is now (you keep its loot and XP).', actions: [{ label: 'Start new run', value: 1, cls: 'primary' }, { label: 'Cancel', value: 0 }] });
    if (v) start();
  };
}

/* ------------------------------------------------------------------ run */
async function start() {
  const go = $('#twgo'); if (go) { go.disabled = true; go.textContent = 'Opening the gate…'; }
  try {
    const r = await towerStart(T.subj, [...T.cards]);
    enterRun(r, true);
  } catch (e) { toast(e.message, 3500); drawLobby(); }
}
async function resume(id) {
  try {
    const r = await towerResume(id);
    if (r.over) { toast('That climb already ended.', 2000); T.lobby.open_run = null; drawLobby(); return; }
    T.subj = r.subject_id; enterRun(r, false);
  } catch (e) { toast(e.message, 3000); }
}
function enterRun(r, fresh) {
  T.view = 'run'; T.run = r; T.q = r.question; T.hints = r.question?.hints || []; T.fb = null; T.cast = null; T.monState = 'in';
  T.startLives = r.lives;
  drawRun();
  if (fresh) showLadder({ intro: true }); else markStart();
}

function monFor(floor, fam) {
  const k = ((floor - 1) % 10) + 1;
  const tier = k === 10 ? 'exam' : k === 9 ? 'boss' : k >= 5 ? 'elite' : 'minion';
  const nm = FAMILIES[fam].forms[{ minion: 0, elite: 1, boss: 2, exam: 3 }[tier]];
  return { tier, src: monsterSrc(fam, tier), label: { minion: 'Minion', elite: 'Elite', boss: 'Boss', exam: 'Floor Boss' }[tier], name: nm };
}

function drawRun() {
  const { run: r, q } = T;
  const fam = famOfSub(r.subject_id), m = subjectMeta(subOf(r.subject_id));
  const floor = q ? q.floor : r.floor + 1;
  const mon = monFor(floor, fam);
  const ch = q && T.d.idx[q.chapter_id], boss = q && bossBy(q.chapter_id);
  const nextBoss = Math.ceil(floor / 10) * 10, away = nextBoss - floor;
  const [cn, cc] = CHEST_AT(nextBoss);
  const lives = Math.max(0, r.lives);
  const hearts = [0, 1, 2].map(i => `<i class="${i < lives ? 'on' : ''}">❤</i>`).join('');
  const order = q?.option_order || ['A', 'B', 'C', 'D'];
  const cut = new Set(r.cut || []);
  $('#tower-body').innerHTML = `<div class="tw-run ${q?.boss ? 'is-boss' : ''}" style="--sc:${FAMILIES[fam].c}">
    <div class="tw-hud"><button class="back" id="twquit" aria-label="Leave the tower">×</button>
      <div class="grow"><div class="nd-label">${esc(m.short)} tower${r.rewarded ? '' : ' · practice run'}</div><div class="tw-floor">FLOOR ${floor}</div></div>
      <div class="tw-hearts" aria-label="${lives} lives left">${hearts}${r.guard_on ? '<b class="tw-guard" title="Guard is up">🛡️</b>' : ''}${r.last_stand ? '<b class="tw-ls" title="Last Stand ready">✚</b>' : ''}</div>
      <button class="back mute" id="twmute2" aria-label="${muted() ? 'Sound off' : 'Sound on'}">${muted() ? '🔇' : '🔊'}</button></div>
    <div class="tw-prog"><div class="row between"><span class="nd-label">${away ? `Boss at ${nextBoss} · ${away} to go` : '⚠ Floor boss · hard'}</span>
      ${r.rewarded ? `<span class="nd-label" style="color:${cc}">🎁 ${cn} chest</span>` : '<span class="nd-label">no chest today</span>'}</div>
      <div class="tw-bar"><i style="width:${((10 - away) / 10) * 100}%;background:linear-gradient(90deg,${cc},#fff)"></i></div></div>
    <div class="tw-arena ${mon.tier}" id="twarena">
      <div class="tw-floorline"></div>
      <img class="tw-hero" id="twhero" src="${STAGE_ART(T.d.rk.rank)}" alt="" decoding="async">
      <img class="tw-mon ${T.monState || ''}" id="twmon" src="${mon.src}" alt="" decoding="async">
      ${ch ? `<div class="tw-chap"><span>${esc(m.short)} ${esc(shortCode(ch.code))}</span></div>` : ''}
      <div class="tw-vs">VS</div>
      <div class="tw-mname"><b>${esc(mon.tier === 'exam' ? `${FAMILIES[fam].forms[3]}` : boss?.name || mon.name)}</b><span>${mon.label}${ch ? ` · ${esc(ch.name)}` : ''}</span></div>
      <div class="tw-fx" id="twfx"></div>
    </div>
    <div class="tw-skills">${r.skills.map(s => { const b = s.chapter_id && bossBy(s.chapter_id);
      return `<button class="tskb ${s.used ? 'used' : ''} k-${s.kind}" data-skill="${s.id}" ${s.used || T.fb ? 'disabled' : ''} title="${esc(SK[s.kind].help)}">
        <span class="ic">${SK[s.kind].ic}</span><b>${SK[s.kind].name}</b><span>${s.used ? 'used' : s.src === 'card' ? esc(b ? shortCode(b.ch.code) : 'card') : s.src === 'weapon' ? 'weapon' : 'free'}</span></button>`; }).join('')}</div>
    ${q?.context ? `<div class="tw-ctx"><div class="nd-label">Read this first</div><div class="body">${rich(q.context)}</div></div>` : ''}
    <div class="tw-q"><div class="stem">${q ? rich(q.stem) : ''}</div><button class="qimg" id="twimg" hidden aria-label="Open picture"></button></div>
    ${T.hints?.length ? `<div class="tw-hints">${T.hints.map((h, i) => `<div class="tw-hint"><b>${i ? 'First step' : 'Method'}</b>${rich(h)}</div>`).join('')}</div>` : ''}
    <div class="tw-opts">${q ? order.map((orig, pos) => {
      const st = T.fb ? (orig === T.fb.answer_key ? 'correct' : orig === T.fb.chosen ? 'wrong' : 'dim') : cut.has(orig) ? 'cut' : '';
      return `<button class="opt ${st}" data-orig="${orig}" ${T.fb || cut.has(orig) || T.busy ? 'disabled' : ''}><span class="k" aria-hidden="true">${'ABCD'[pos]}</span><span class="grow">${rich(q.options[orig])}</span></button>`; }).join('') : ''}</div>
    <div id="twfeed" aria-live="polite">${T.fb ? feedHTML() : ''}</div>
  </div>`;
  if (q?.image_path) imageUrl(q.image_path).then(url => { const im = $('#twimg'); if (!url || !im || T.q !== q) return; im.innerHTML = `<img src="${esc(url)}" alt="Picture for this question">`; im.hidden = false; im.onclick = () => window.open(url, '_blank', 'noopener'); });
  $('#twquit').onclick = quit;
  $('#twmute2').onclick = () => { setMuted(!muted()); $('#twmute2').textContent = muted() ? '🔇' : '🔊'; };
  $$('[data-skill]').forEach(b => b.onclick = () => useSkill(b.dataset.skill));
  $$('.tw-opts .opt').forEach(b => b.onclick = () => answer(b.dataset.orig));
  const nx = $('#twnext'); if (nx) nx.onclick = next;
  if (T.cast) { castFX(T.cast); T.cast = null; }
}

function feedHTML() {
  const f = T.fb, r = T.run;
  const nextFloor = (r.question?.floor) || (r.floor + 1);
  const fam = famOfSub(r.subject_id);
  const nm = monFor(nextFloor, fam);
  const over = !!f.result;
  const head = f.is_correct ? `<b class="ok">${f.boss ? 'Floor boss down!' : 'Right!'}</b>` : f.guarded ? '<b class="warn">🛡️ Guard blocked it!</b>' : f.last_stand_used ? '<b class="warn">✚ LAST STAND! You hold on.</b>' : '<b class="bad">Hit!</b>';
  return `<div class="tw-feed ${f.is_correct ? 'ok' : 'bad'}">${head} <span>${rich(f.explanation || '')}</span></div>
    ${over ? '' : `<div class="tw-next"><img src="${nm.src}" alt="" decoding="async"><div class="grow"><div class="nd-label">Floor ${nextFloor}</div><b>${esc(nm.tier === 'exam' ? 'Floor Boss · ' + FAMILIES[fam].forms[3] : nm.name + ' · ' + nm.label)}</b></div>${nm.tier === 'exam' ? '<span class="tchip r">boss!</span>' : ''}</div>`}
    <button class="nd-btn primary block lg" id="twnext">${over ? 'See the result →' : f.chest ? 'Open the chest →' : 'Next floor →'}</button>`;
}

async function useSkill(id) {
  if (T.busy || T.fb) return;
  const s = T.run.skills.find(x => x.id === id); if (!s || s.used) return;
  T.busy = true;
  try {
    const r = await towerSkill(T.run.run_id, id);
    s.used = true;
    if (r.hints) T.hints = r.hints;
    if (r.cut) T.run.cut = r.cut;
    if (r.guard_on) T.run.guard_on = true;
    const b = s.chapter_id && bossBy(s.chapter_id);
    T.cast = `${SK[s.kind].ic} ${b ? esc(b.tech) + ' · ' : ''}${SK[s.kind].name.toUpperCase()}!`;
    s.kind === 'guard' ? sfx.shield() : sfx.star(2);
  } catch (e) { toast(e.message, 2600); }
  T.busy = false; drawRun();
}

async function answer(key) {
  if (T.busy || T.fb || !T.q) return;
  T.busy = true;
  $$('.tw-opts .opt').forEach(b => { b.disabled = true; b.classList.toggle('picked', b.dataset.orig === key); });
  const ms = T.q._t0 ? performance.now() - T.q._t0 : 0;
  let res;
  try { res = await towerAnswer(T.run.run_id, T.q.question_id, key, ms); }
  catch (e) { T.busy = false; toast(e.message, 3000); drawRun(); return; }
  T.busy = false;
  T.fb = { ...res, chosen: key };
  const prevQ = T.q;
  // keep the question on screen with its answer; the server already moved on
  if (res.result) T.over = res.result; else { T.pending = res; }
  T.run = { ...T.run, ...(res.result || res), question: res.question, skills: (res.result || res).skills || T.run.skills };
  T.q = prevQ;
  drawRun();
  hitFX(res);
}

function next() {
  const f = T.fb; if (!f) return;
  if (f.result) { overView(f.result); return; }
  const go = () => { T.fb = null; T.q = T.run.question; T.hints = []; T.run.cut = null; T.monState = 'in'; drawRun(); markStart(); };
  const cleared = f.boss && f.is_correct;
  if (f.chest || f.titles?.length) { chestReveal(f, () => (cleared ? showLadder({ after: go }) : go())); return; }
  if (cleared) { showLadder({ after: go }); return; }
  go();
}
function markStart() { if (T.q) T.q._t0 = performance.now(); }

/* ------------------------------------------------------------------ fx */
function castFX(txt) {
  const fx = $('#twfx'); if (!fx) return;
  fx.insertAdjacentHTML('beforeend', `<div class="tw-cast">${txt}</div>`);
  setTimeout(() => fx.querySelector('.tw-cast')?.remove(), 1400);
}
function hitFX(res) {
  const fx = $('#twfx'), mon = $('#twmon'), hero = $('#twhero'), ar = $('#twarena');
  if (!fx) return;
  const rm = reducedMotion();
  if (res.is_correct) {
    res.boss ? sfx.seal() : sfx.hit(T.run.floor % 10);
    hero?.classList.add('dash'); fx.insertAdjacentHTML('beforeend', `<div class="tw-slash"></div><div class="tw-ko">${res.boss ? 'BOSS K.O.!' : OK_WORDS[Math.floor(Math.random() * OK_WORDS.length)]}</div><div class="tw-xp">+${res.boss ? 28 : 8} XP</div>`);
    setTimeout(() => mon?.classList.add('down'), rm ? 0 : 220);
    T.monState = 'down';
  } else {
    res.guarded ? sfx.shield() : sfx.miss();
    mon?.classList.add('lunge');
    ar?.classList.add(res.guarded || res.last_stand_used ? 'blocked' : 'hurt');
    fx.insertAdjacentHTML('beforeend', res.guarded ? '<div class="tw-ko blk">BLOCKED!</div>' : res.last_stand_used ? '<div class="tw-ko blk">LAST STAND!</div>' : '<div class="tw-ko bad">OUCH!</div><div class="tw-heart">💔</div>');
  }
  $('#twfeed')?.scrollIntoView({ behavior: rm ? 'auto' : 'smooth', block: 'nearest' });
}

/* ------------------------------------------------------------------ ladder + chest overlays */
function showLadder({ intro = false, after = null } = {}) {
  const r = T.run, fam = famOfSub(r.subject_id), m = subjectMeta(subOf(r.subject_id));
  const cur = (r.question?.floor) || (r.floor + 1);
  const base = Math.floor((cur - 1) / 10) * 10, top = base + 10;
  const [cn, cc] = CHEST_AT(top);
  const rungs = [];
  for (let f = top; f > base; f--) {
    const mn = monFor(f, fam);
    if (f === top) rungs.push(`<div class="rung rboss"><span class="n">${f}</span><img src="${mn.src}" alt=""><div class="grow"><b>Floor Boss · ${esc(FAMILIES[fam].forms[3])}</b><span>always a hard question</span></div>${r.rewarded ? `<span class="chestic" style="--c:${cc}"></span><span class="ct" style="color:${cc}">${cn}</span>` : ''}</div>`);
    else if (f === cur) rungs.push(`<div class="rung me"><span class="n">${f}</span><img class="hero" src="${STAGE_ART(T.d.rk.rank)}" alt=""><b>You are here</b><span style="color:var(--nd-gold)">next fight</span></div>`);
    else if (f < cur) rungs.push(`<div class="rung done"><span class="n">${f}</span><img src="${mn.src}" alt=""><b>${mn.label}</b><span>✓</span></div>`);
    else rungs.push(`<div class="rung"><span class="n">${f}</span><img src="${mn.src}" alt=""><b>${esc(mn.name)}</b><span>${mn.label}</span></div>`);
  }
  const wrap = document.createElement('div');
  wrap.className = 'tw-over nd'; wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-label', 'Tower ladder');
  wrap.innerHTML = `<div class="tw-ladder" style="--sc:${FAMILIES[fam].c}"><span class="tw-kanji" aria-hidden="true">塔</span>
    <div class="nd-label">${esc(m.short)} tower · ${intro ? 'the climb begins' : `Floor ${base} cleared`}</div>
    <div class="nd-h1">${intro ? (base ? `Back to Floor ${cur}` : 'Floors 1–10') : `Floors ${base + 1}–${top}`}</div>
    <div class="tchips" style="margin:8px 0 10px"><span class="tchip">❤ ${r.lives} li${r.lives === 1 ? 'fe' : 'ves'}</span><span class="tchip y">⭐ ${r.floor} cleared</span><span class="tchip">${base < 10 ? 'mostly medium' : base < 30 ? 'medium + hard' : 'mostly hard'}</span></div>
    <div class="ladder">${rungs.join('')}</div>
    <button class="nd-btn primary block lg" style="margin-top:12px" id="twclimb">${intro && !base ? 'FIGHT! →' : `Climb to Floor ${cur} →`}</button></div>`;
  $('#app').appendChild(wrap);
  sfx.round(2);
  const done = () => { wrap.remove(); after ? after() : markStart(); };
  $('#twclimb', wrap).onclick = done; $('#twclimb', wrap).focus();
}

function lootIcon(it, size = 96) {
  if (!it) return '';
  if (it.kind === 'weapon') return svgDoc(`<g transform="rotate(-38 722 640)">${itemArt(it.key)}</g>`, { w: size, h: size, view: itemView(it.key) }).replace('<svg ', '<svg preserveAspectRatio="xMidYMid meet" aria-hidden="true" ');
  if (it.kind === 'aura') { const c = it.data?.color || '#fff'; return `<span class="tl-aura" style="--ac:${esc(c)};width:${size}px;height:${size}px"></span>`; }
  if (it.kind === 'frame') return `<span class="ci-frame tl-frame" style="--c1:${esc(it.data?.c1 || '#fff')};--c2:${esc(it.data?.c2 || '#333')}">✦</span>`;
  return `<span class="tl-title">“${esc(it.name)}”</span>`;
}
function chestReveal(f, after) {
  const items = [];
  if (f.chest) items.push(f.chest);
  for (const t of f.titles || []) items.push({ item: t, rarity: 'legendary', title: true });
  let i = 0;
  const wrap = document.createElement('div');
  wrap.className = 'tw-over tw-chestov nd'; wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-label', 'Chest');
  $('#app').appendChild(wrap);
  const step = () => {
    if (i >= items.length) { wrap.remove(); after(); return; }
    const c = items[i++], rar = c.rarity, col = RCOL[rar] || '#fff', it = c.item;
    const pw = it ? powerOf({ key: it.key, rarity: { common: 'silver', rare: 'gold', epic: 'epic', legendary: 'legendary' }[it.rarity] || 'silver' }) : 0;
    wrap.innerHTML = `<div class="tw-chest r-${rar}" style="--rc:${col}"><div class="irays" aria-hidden="true"></div>
      <div class="nd-label" style="color:${col}">${c.title ? 'Legendary title unlocked' : `Floor ${c.floor} · ${rar} chest`}</div>
      <div class="tw-box"><div class="lid"></div><div class="base"></div></div>
      <div class="tw-prize" hidden>${c.duplicate ? `<div class="tw-shards">💎 +${c.shards_gained}</div><div class="inm">Shards</div><p class="ids">You already own everything at this rarity. 10 shards = pick any item.</p>`
        : `<div class="tw-pic">${lootIcon(it, 120)}</div><span class="irr" style="--rc:${col}">${'★'.repeat(STARS[{ common: 'silver', rare: 'gold', epic: 'epic', legendary: 'legendary' }[it.rarity]] || 2)} ${esc(it.rarity)} · ${esc(it.kind)}</span><div class="inm">${esc(it.name)}</div><div class="ipw"><b class="num">⚡${pw}</b><small>POWER</small></div>`}</div>
      <button class="nd-btn primary block lg" id="twtake" hidden>${i < items.length ? 'Next →' : 'Keep climbing →'}</button></div>`;
    sfx.chest(rar === 'legendary' ? 'legendary' : rar === 'epic' ? 'epic' : 'rare');
    const open = () => { wrap.querySelector('.tw-box')?.classList.add('open'); setTimeout(() => { $('.tw-prize', wrap).hidden = false; $('#twtake', wrap).hidden = false; $('#twtake', wrap).focus(); }, reducedMotion() ? 0 : 650); };
    setTimeout(open, reducedMotion() ? 0 : 500);
    wrap.onclick = (e) => { if (e.target.closest('#twtake')) step(); };
  };
  step();
}

/* ------------------------------------------------------------------ quit + over */
async function quit() {
  const r = T.run;
  if (!T.fb) {
    const v = await sheet({ title: 'Leave the tower?', body: `Your climb ends at Floor ${r.floor}. You keep the loot and XP you earned. No Retreat cost.`, actions: [{ label: 'Leave and see result', value: 1 }, { label: 'Keep climbing', value: 0, cls: 'primary' }] });
    if (!v) return;
  }
  if (T.fb?.result) { overView(T.fb.result); return; }
  try { overView(await towerEnd(r.run_id)); } catch (e) { toast(e.message, 3000); }
}

function overView(res) {
  const r = res, fam = famOfSub(r.subject_id), m = subjectMeta(subOf(r.subject_id));
  T.view = 'over'; T.run = null; T.fb = null; T.q = null;
  const loot = (r.loot || []).map(x => x.kind ? { item: x, rarity: 'legendary', title: true } : x);
  const title = r.lives <= 0 ? 'DEFEATED' : 'TOWER LEFT';
  const mistakes = (res.answered || 0) - (res.correct || 0);
  $('#tower-body').innerHTML = `<div class="tw-wrap tw-end" style="--sc:${FAMILIES[fam].c}"><span class="tw-kanji" aria-hidden="true">塔</span>
    <div class="nd-label" style="text-align:center">${esc(m.short)} tower</div>
    <div class="tw-endt ${r.lives <= 0 ? 'bad' : ''}">${title}</div>
    <div class="tw-endf">Floor <b class="num">${r.floor}</b></div>
    ${res.new_record ? `<div class="tw-rec">🏆 New record! (was Floor ${res.prev_best || 0})</div>` : `<div class="tw-mini" style="text-align:center">Best: Floor ${Math.max(res.prev_best || 0, r.floor)}</div>`}
    <div class="tw-stat3"><div><b class="num">${r.floor}</b><span>floors</span></div><div><b class="num">${res.correct || 0}/${res.answered || 0}</b><span>correct</span></div><div><b class="num" style="color:var(--nd-gold)">+${fmtNum(res.xp || 0)}</b><span>XP${res.capped ? ' (cap)' : ''}</span></div></div>
    <div class="nd-card"><div class="nd-label">Loot</div>${loot.length ? loot.map(c => { const it = c.item, col = RCOL[c.rarity] || '#fff';
      return `<div class="tw-loot" style="--rc:${col}"><span class="ic">${c.duplicate ? '💎' : lootIcon(it, 40)}</span><div class="grow"><b>${c.duplicate ? `+${c.shards_gained} shards` : esc(it.name)}</b><span>${c.title ? 'Legendary title' : `${esc(c.rarity)} · Floor ${c.floor}`}</span></div></div>`; }).join('')
      : `<p class="tw-note">${r.rewarded ? (r.floor >= 10 ? 'No chest this time.' : 'Reach Floor 10 and beat its boss to open a chest.') : 'Practice run: today\'s chests are used. Records and XP still count.'}</p>`}</div>
    ${mistakes > 0 ? `<p class="tw-note" style="text-align:center">${mistakes} missed question${mistakes === 1 ? '' : 's'} went to 🔁 Revenge.</p>` : ''}
    <button class="nd-btn primary block lg" id="twagain">⚔️ Climb again</button>
    <div class="row" style="gap:10px">${loot.some(c => c.item && !c.duplicate) ? '<button class="nd-btn grow" data-nav="#/hero">Equip loot</button>' : ''}<button class="nd-btn grow" data-nav="#/dojo">Back to Dojo</button></div>
  </div>`;
  if (r.lives <= 0) sfx.miss(); else sfx.round(1);
  if (res.new_record) setTimeout(() => sfx.seal(), 300);
  $('#twagain').onclick = () => { T.view = 'lobby'; renderTower(); };
}

/* keyboard: 1–4 / A–D answer, Enter = next */
document.addEventListener('keydown', (e) => {
  if (T?.view !== 'run' || !document.getElementById('s-tower')?.classList.contains('active') || document.querySelector('.tw-over, .sheet')) return;
  if (e.key === 'Enter' && T.fb) { e.preventDefault(); next(); return; }
  const i = '1234'.indexOf(e.key) >= 0 ? '1234'.indexOf(e.key) : 'abcd'.indexOf(e.key.toLowerCase());
  if (i >= 0 && !T.fb && T.q) { const b = $$('.tw-opts .opt')[i]; if (b && !b.disabled) answer(b.dataset.orig); }
});

/** Leaving the screen mid-run keeps the run open on the server; the lobby offers "Continue". */
window.addEventListener('hashchange', () => { if (!/^#\/tower/.test(location.hash) && T) { T.view = 'lobby'; T.run = null; T.fb = null; } });
