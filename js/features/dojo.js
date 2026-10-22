// Dojo (v2.0.0 Night Dojo): mission-control hub — hero banner, today's mission, exam gate, priority hunt, monster families.
// Logic unchanged from v1.8 (rank, exam, Ki/XP cap, shield, bosses, cards); only presentation is new.
import { $, $$, esc, subjectMeta, shortCode, sheet, toast, jakartaDate, shortDay, fmtNum } from '../ui.js';
import { loadProgress, progressOf, loadDojo, startAttempt, startRankExam, loadHero } from '../store.js';
import { heroSVG, heroPic } from '../hero/art.js';
import { heroContext, inventory, validEquip } from '../hero/items.js';
import { app, catalog, chapterIndex, viewerId } from '../state.js';
import { show, navigate } from '../router.js';
import { RANKS, rules, bossName, techName, bossState, bossSVG, cardSVG, beltSVG, cardTier, TIER_LABEL, rankInfo } from '../dojo.js';
import { FAMILIES, familyOf, phaseOf, formName, PHASES, monsterSVG, gateSVG, familyEmblem, familyPortrait, examBoss, GATE_ORDER } from '../monsters.js';


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
    const fam = familyOf(ch), phase = phaseOf(st, R);
    return { ch, m, st, beaten: dj.beaten[c.chapter_id] || null, angry: (dj.angry || []).includes(c.chapter_id), ...nm, tech, fam, phase, title: formName(fam, ['sealed', 'new'].includes(phase) ? 'boss' : phase) };
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

export async function fight(chapterId, btn) {
  if (btn) { btn.disabled = true; btn.textContent = 'Summoning…'; }
  try { const d = await startAttempt([chapterId], 30); navigate(`#/quiz/${d.attempt.id}`); }
  catch (e) {
    toast(e.code === 'in_progress' ? 'Finish or leave your other practice first (see Home).' : e.message, 3500);
    if (btn) { btn.disabled = false; btn.textContent = 'Fight (30 questions) →'; }
  }
}

const PHASE_TEXT = {
  new: 'Not met yet. Answer a few questions in this chapter to reveal it.',
  minion: 'A Minion. Reach 15 answers in this chapter and it grows into its Elite form.',
  elite: 'An Elite. Lift your last-30 accuracy above 70% to draw out the Boss.',
  boss: 'The Boss is here. Hit 80% on your last 30 answers to seal it.',
  sealed: 'Sealed. Keep your last-30 accuracy at 80% or more to keep it locked.',
};

/** Collectible boss card (Night Dojo). */
export function bossCard(b) {
  const f = FAMILIES[b.fam], ph = b.phase, came = b.st.status === 'revived';
  const tier = ph === 'sealed' ? '✓' : PHASES[ph].tier || '?';
  return `<button class="bcard ${ph}${came ? ' revived' : ''}" data-boss="${b.ch.chapter_id}" style="--fc:${f.c}">
    <div class="port">${monsterSVG(b.ch, { phase: ph, size: 118, angry: b.angry })}<span class="tier" title="${PHASES[ph].label}">${tier}</span>${came ? '<span class="stamp nd-pill" style="--c:#FF6B7A"><span class="dot"></span>Came back</span>' : b.angry && ph !== 'sealed' ? '<span class="stamp nd-pill" style="--c:#FF6B7A"><span class="dot"></span>Angry</span>' : ''}</div>
    <div class="meta">
      <div class="nm">${ph === 'new' ? '???' : esc(b.name)}</div>
      <div class="sub">${ph === 'new' ? 'Unknown' : `${PHASES[ph].label} · ${esc(b.title)}`}<br>${esc(b.m.short)} ${esc(shortCode(b.ch.code))} · ${esc(b.ch.name)}</div>
      ${ph === 'sealed' ? `<div class="hook">🃏 ${esc(b.tech)} · ${TIER_LABEL[cardTier(b.beaten?.best_accuracy || 80)]}</div>` : `<div class="nd-bar" aria-label="HP ${b.st.hp}%"><i style="--p:${b.st.hp}%"></i></div><div class="hook">Seal reward: ${esc(b.tech)} card</div>`}
    </div></button>`;
}

/** Exam Gate Boss card. */
export function gateCard(d) {
  const { rk, R, viewing, triedToday } = d;
  const have = GATE_ORDER.filter(k => d.bosses.some(b => b.fam === k)), order = have.length ? have : GATE_ORDER;
  const gf = order[((rk.rank || 0) + (rk.next ? 1 : 0)) % order.length], gk = FAMILIES[gf];
  if (!rk.next) return `<div class="nd-card gate-card" style="--belt:${rk.color}">${examBoss(gf, { size: 150, belt: rk.color })}<div><div class="nd-label">Final gate</div><div class="nd-h2">All gates opened</div><p class="nd-sub">You are a ${esc(rk.name)}. Keep every seal strong.</p></div></div>`;
  const pct = Math.min(100, Math.round(100 * rk.have / rk.need));
  const action = viewing ? '' : rk.ready ? (triedToday ? '<p class="nd-sub" style="margin-top:8px">You challenged the gate today. Train and return tomorrow.</p>' : '<button class="nd-btn primary" id="exambtn" style="margin-top:10px">Challenge the gate →</button>') : '';
  return `<div class="nd-card gate-card ${rk.ready ? 'emph' : ''}" style="--belt:${rk.next.color};--em:${rk.next.color === '#F4F1EA' ? '#FFD25A' : rk.next.color}">
    <div>${examBoss(gf, { size: 150, locked: !rk.ready, belt: rk.next.color })}</div>
    <div style="min-width:0"><div class="nd-label">Exam Boss · ${esc(rk.next.belt)} gate</div>
      <div class="nd-h2" style="margin:4px 0 2px">${esc(gk.forms[3])}</div>
      <p class="nd-sub" style="font-size:12px;margin-bottom:6px">${esc(gk.name)} · guards the path to ${esc(rk.next.name)}</p>
      <p class="nd-sub">${rk.ready ? `Open: 30 questions from your sealed bosses. Pass with ${R.pass}% to evolve.` : `Seal ${rk.need - rk.have} more boss${rk.need - rk.have === 1 ? '' : 'es'} to open this gate.`}</p>
      <div class="nd-bar" style="margin-top:10px"><i style="--p:${pct}%;--bc:linear-gradient(90deg,${rk.next.color === '#F4F1EA' ? '#fff' : rk.next.color},#FFD25A)"></i></div>
      <div class="nd-sub nd-num" style="margin-top:4px;font-size:12px">${rk.have}/${rk.need} sealed</div>${action}</div>
  </div>`;
}

export function missionRow(d) {
  const { prog, R } = d;
  const n = prog?.answers_today || 0, pct = Math.min(100, Math.round(100 * n / R.target)), capped = n >= R.cap;
  const streak = prog?.current_streak || 0;
  const shield = prog?.freeze_ready ? (prog?.freeze_needed ? 'Shield protecting today' : 'Shield ready') : 'Shield recharging';
  const pr = { revived: 0, cracked: 1, fight: 2 };
  const next = d.bosses.filter(b => b.st.status in pr).sort((a, b) => pr[a.st.status] - pr[b.st.status] || a.st.hp - b.st.hp)[0];
  return `<div class="dj-row">
    <div class="nd-card mini"><div class="nd-label">Today's Ki</div>
      <div class="row" style="gap:12px;align-items:center"><div class="ring" style="--p:${pct};--rc:${capped ? '#46E0A0' : '#FFD25A'}"><span>${n}</span></div>
      <div class="nd-sub" style="font-size:12.5px">${capped ? `XP cap reached. Rest!` : n >= R.target ? 'Mission done ✓' : `${R.target - n} to go`}<br><span style="color:var(--nd-faint)">target ${R.target}</span></div></div></div>
    <div class="nd-card mini"><div class="nd-label">Streak</div>
      <div class="row" style="gap:10px;align-items:baseline"><span class="big">${streak}</span><span class="nd-sub">day${streak === 1 ? '' : 's'}</span></div>
      <span class="nd-pill" style="--c:${prog?.freeze_ready ? '#6FB7FF' : '#7A7299'};align-self:flex-start"><span class="dot"></span>🛡️ ${shield}</span></div>
    <div class="nd-card mini" ${next ? `data-boss="${next.ch.chapter_id}" style="cursor:pointer"` : ''}><div class="nd-label">Next target</div>
      ${next ? `<div class="row" style="gap:10px;align-items:center"><div style="flex:none">${monsterSVG(next.ch, { phase: next.phase, size: 54 })}</div><div style="min-width:0"><b style="color:#fff">${esc(next.name)}</b><div class="nd-sub" style="font-size:12px">${esc(next.m.short)} ${esc(shortCode(next.ch.code))} · HP ${next.st.hp}%</div></div></div>` : '<div class="nd-sub">Pick any chapter to start a hunt.</div>'}</div>
  </div>`;
}

export function openBoss(b, viewing) {
  const ph = b.phase || 'boss', f = FAMILIES[b.fam || familyOf(b.ch)], s = b.st;
  const card = b.beaten ? `<div class="row" style="gap:12px;margin-top:12px;align-items:center">${cardSVG(b.ch, f.c, cardTier(b.beaten.best_accuracy), { size: 60 })}
      <div><div class="eyebrow">Technique card</div><b>${esc(b.tech)}</b><div class="note">${TIER_LABEL[cardTier(b.beaten.best_accuracy)]} · best ${b.beaten.best_accuracy}% · since ${esc(shortDay(b.beaten.first_defeated_at))}</div></div></div>` : '';
  const body = `<div style="text-align:center;background:radial-gradient(50% 60% at 50% 60%,${f.c}55,transparent 70%);border-radius:16px">${monsterSVG(b.ch, { phase: ph, size: 150 })}</div>
    <p class="note" style="text-align:center;margin:6px 0 10px">${PHASES[ph].label} · ${esc(b.title)} · ${esc(f.name)}<br>guards <b>${esc(b.m.short)} ${esc(shortCode(b.ch.code))} ${esc(b.ch.name)}</b></p>
    <div class="hp big"><i style="--p:${ph === 'sealed' ? 0 : s.hp}%"></i></div>
    <div class="row between note num" style="margin-top:4px"><span>HP ${ph === 'sealed' ? 0 : s.hp}%</span><span>${s.n ? `last 30: ${s.acc}% · ${s.n} answers` : 'no answers yet'}</span></div>
    <p style="margin-top:10px">${s.status === 'revived' ? '<b>It broke its seal!</b> ' : ''}${esc(PHASE_TEXT[ph])}</p>
    ${b.beaten ? card : `<p class="note" style="margin-top:6px">Seal reward: technique card <b>${esc(b.tech)}</b> + progress toward ${esc(f.name)} loot.</p>`}`;
  const actions = viewing ? [{ label: 'Close', value: false }] : [{ label: 'Close', value: false }, { label: ph === 'sealed' ? 'Train again (30) →' : 'Fight (30 questions) →', value: true, cls: 'primary' }];
  const p = sheet({ title: ph === 'new' ? 'Unknown guardian' : b.name, body, actions }).then(go => { if (go) fight(b.ch.chapter_id); });
  setTimeout(() => document.querySelectorAll('.sheet .mon-wrap').forEach(w => w.onclick = () => { w.classList.remove('hit'); void w.offsetWidth; w.classList.add('hit'); }), 50);
  return p;
}

export function bindExam(root, d) {
  const eb = root.querySelector('#exambtn');
  if (!eb) return;
  const { R } = d;
  eb.onclick = async () => {
    const ok = await sheet({ title: `Gate challenge · ${d.rk.next.name}`, body: `<p>30 questions mixed from your <b>${d.beatNow}</b> sealed bosses. Pass with <b>${R.pass}%</b> or more to become <b>${esc(d.rk.next.name)}</b> (${esc(d.rk.next.belt)}).</p><p class="note" style="margin-top:8px">One try per day. Hints are allowed. If you leave halfway, today's try is used.</p>`,
      actions: [{ label: 'Not yet', value: false }, { label: 'Start exam →', value: true, cls: 'primary' }] });
    if (!ok) return;
    eb.disabled = true; eb.textContent = 'Opening the gate…';
    try { const a = await startRankExam(); navigate(`#/quiz/${a.attempt.id}`); }
    catch (e) { toast(e.code === 'in_progress' ? 'Finish or leave your other practice first (see Home).' : e.message, 4000); eb.disabled = false; eb.textContent = 'Challenge the gate →'; }
  };
}

export async function renderDojo() {
  show('dojo');
  const body = $('#dojo-body');
  if (!body.dataset.ready) body.innerHTML = '<div class="loading" style="height:50vh"><div class="spin"></div></div>';
  let d, hp = { equipped: {} };
  try { [d, hp] = await Promise.all([dojoData(true), loadHero(viewerId()).catch(() => ({ equipped: {} }))]); } catch (e) { body.innerHTML = `<div class="nd-card">${esc(e.message)}</div>`; return; }
  const hctx = heroContext(d), heq = validEquip(hp.equipped, inventory(hctx), hctx);
  const { bosses, viewing, rk } = d;
  const pr = { revived: 0, cracked: 1, boss: 2, elite: 3, minion: 4 };
  const targets = bosses.filter(b => b.phase !== 'sealed' && b.phase !== 'new').sort((a, b) => ((b.st.status === 'revived') - (a.st.status === 'revived')) || (pr[a.phase] - pr[b.phase]) || a.st.hp - b.st.hp).slice(0, 3);
  const fams = Object.keys(FAMILIES).map(k => ({ k, f: FAMILIES[k], list: bosses.filter(b => b.fam === k) })).filter(x => x.list.length);
  const lv = hctx.lv;

  body.innerHTML = `<div class="nd-stack">
    <div class="row between"><div><div class="nd-label">${viewing ? 'Dad\'s view · ' : ''}Mission control</div><div class="nd-h1">Dojo</div></div></div>
    <button class="nd-card dj-hero" data-nav="#/hero" style="--belt:${rk.color}" aria-label="Open hero profile">
      <div class="art">${heroPic({ stage: rk.rank }, { w: 240, h: 330, fit: 'cover' })}</div>
      <div class="info">
        <span class="belt-chip" style="--belt:${rk.color}"><i></i>${esc(rk.belt)}</span>
        <div class="nd-h1" style="font-size:clamp(26px,5vw,36px)">${esc(rk.name)}</div>
        <div class="lvl"><span class="nd-label">Level</span><b>${lv.level}</b><span class="nd-sub">${esc(lv.tier)}</span></div>
        <div class="nd-bar"><i style="--p:${lv.pct}%"></i></div>
        <div class="nd-sub nd-num" style="font-size:12px">${fmtNum(lv.toNext)} XP to Level ${lv.level + 1}</div>
        <span class="nd-btn small" style="align-self:flex-start;margin-top:6px">Hero profile →</span>
      </div>
    </button>
    ${missionRow(d)}
    <button class="nd-card dj-dex" data-nav="#/dex"><span class="ic">📖</span><div class="grow"><b>Monster Dex</b><span class="nd-sub">Collect a card for every boss you seal</span></div><b class="num">${bosses.filter(b => b.beaten).length}/${bosses.length}</b><span aria-hidden="true">›</span></button>
    ${gateCard(d)}
    ${targets.length ? `<div><div class="nd-sec"><div class="nd-h2">Priority hunt</div><button class="nd-link" data-nav="#/bosses">All bosses →</button></div>
      <div class="targets">${targets.map(bossCard).join('')}</div></div>` : ''}
    <div><div class="nd-sec"><div class="nd-h2">Monster families</div><span class="nd-sub nd-num">${d.beatNow}/${bosses.length} sealed</span></div>
      <div class="fam-list">${fams.map(({ k, f, list }) => { const sealed = list.filter(b => b.phase === 'sealed').length; return `<button class="fam-row" data-nav="#/bosses/${k}" style="--fc:${f.c}">
        ${familyPortrait(k, 44)}<div style="min-width:0"><b>${esc(f.name)}</b> <span class="nd-sub" style="font-size:12px">· ${esc(list[0].m.short)}</span><div class="nd-bar"><i style="--p:${Math.round(100 * sealed / list.length)}%;--bc:${f.c}"></i></div></div>
        <span class="nd-sub nd-num">${sealed}/${list.length} ›</span></button>`; }).join('')}</div></div>
  </div>`;
  body.dataset.ready = '1';
  $$('[data-boss]', body).forEach(el => el.onclick = () => openBoss(bosses.find(b => b.ch.chapter_id === el.dataset.boss), viewing));
  bindExam(body, d);
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
      ${monsterSVG(next.ch, { phase: next.phase, size: 52 })}
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
