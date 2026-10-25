// Hero profile (v2.0.0 Night Dojo): cinematic stage + tabs (Gear, Loot gallery, Mastery paths, Evolution). Logic as v1.9.
// One persistent original character; its look comes from Dojo rank (stage) + equipped items. Never regenerated at runtime.
import { $, $$, esc, toast, fmtNum, shortCode } from '../ui.js';
import { loadHero, saveHero, heroAssets, cosmetics, redeemShards } from '../store.js';
import { sheet } from '../ui.js';
import { app, firstName } from '../state.js';
import { show, navigate, currentRoute } from '../router.js';
import { dojoData } from './dojo.js';
import { RANKS, beltSVG, cardTier } from '../dojo.js';
import { heroSVG, heroPic, STAGE_ART, itemArt, svgDoc } from '../hero/art.js';
import { RARITY, SLOTS, AURAS, inventory, heroContext, validEquip, slotOpen, stats, itemView, BRANCH_TITLES } from '../hero/items.js';
import { FAMILIES, familyEmblem } from '../monsters.js';
import { DESC, powerOf, effectOf, heroPower, SKILL_HELP, STARS } from '../hero/iteminfo.js';
import { sfx } from '../sfx.js';

let stageObj = null, slotFilter = 'all', S = null, saveT = null, heroTab = 'gear';

/** Approved AI layers -> runtime look (assets override the placeholder SVG layer by layer). */
function lookFor(stage, equipped, assets) {
  const look = { stage, equipped, assets: {}, anchors: {} };
  const m = assets.find(a => a.kind === 'master');
  if (m?.url) { look.assets.body = m.url; look.assets.hairBack = 'none'; look.assets.hairFront = 'none'; look.anchors.body = m.anchor; }
  else {   // painted concept art per stage (v2.1.0): one full-body painting replaces every vector layer; weapons are part of the painting
    look.assets.body = STAGE_ART(stage);
    look.anchors.body = { x: 0, y: 100, scale: 1 };   // paintings end ~65 px (of 960) above the rig's foot line (y 1440): drop them onto the floor ring
    for (const k of ['hairBack', 'hairFront', 'outfit', 'back', 'armor', 'accessory', 'weapon']) look.assets[k] = 'none';
    return look;
  }
  for (const a of assets.filter(x => x.kind === 'stage' && x.stage === stage && x.url)) {
    const k = a.slot === 'hair' ? 'hairFront' : a.slot; if (['outfit', 'back', 'hairFront'].includes(k)) { look.assets[k] = a.url; look.anchors[k] = a.anchor; }
  }
  for (const slot of ['weapon', 'armor', 'accessory']) {
    const key = equipped[slot]; const a = key && assets.find(x => x.kind === 'item' && x.item_key === key && x.url);
    if (a) { look.assets[slot] = a.url; look.anchors[slot] = a.anchor; }
  }
  return look;
}

function itemIcon(it, size = 64) {
  if (it.slot === 'aura') {
    const hx = (n) => '#' + n.toString(16).padStart(6, '0');
    const c = hx(AURAS[it.key]?.color ?? 0xffffff), cy = AURAS[it.key]?.cycle;
    if (cy) {   // legendary aura: a swirl of its colours
      const st = cy.map((x, i) => `<stop offset="${(i / (cy.length - 1)).toFixed(2)}" stop-color="${hx(x)}"/>`).join('');
      return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true"><defs><linearGradient id="lg-${it.key}" x1="0" y1="0" x2="1" y2="1">${st}</linearGradient><radialGradient id="g-${it.key}"><stop offset="0" stop-color="#fff"/><stop offset=".4" stop-color="${c}" stop-opacity=".8"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient></defs><circle cx="50" cy="50" r="48" fill="url(#g-${it.key})"/><g class="aswirl"><path d="M50 14 C74 14 86 34 80 50 C74 66 52 60 50 50 C48 40 30 36 22 50 C14 64 28 86 50 86" fill="none" stroke="url(#lg-${it.key})" stroke-width="7" stroke-linecap="round"/><circle cx="50" cy="50" r="15" fill="url(#lg-${it.key})" stroke="#1B1826" stroke-width="3"/></g></svg>`;
    }
    return `<svg viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true"><defs><radialGradient id="g-${it.key}"><stop offset="0" stop-color="#fff"/><stop offset=".35" stop-color="${c}"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient></defs><circle cx="50" cy="50" r="46" fill="url(#g-${it.key})"/><circle cx="50" cy="50" r="18" fill="${c}" stroke="#1B1826" stroke-width="3"/></svg>`;
  }
  const art = it.slot === 'weapon' ? `<g transform="rotate(-38 722 640)">${itemArt(it.key)}</g>` : itemArt(it.key);
  return svgDoc(art, { w: size, h: size, view: itemView(it.key) }).replace('<svg ', '<svg preserveAspectRatio="xMidYMid meet" aria-hidden="true" ');
}

export async function renderHero() {
  show('hero');
  const body = $('#hero-body');
  if (!body.dataset.ready) body.innerHTML = '<div class="loading" style="height:60vh"><div class="spin"></div></div>';
  stageObj?.destroy(); stageObj = null;
  let d, hp, assets = [], cos = { items: [], owned: new Set(), shards: 0 };
  const viewing = !!app.viewAs;
  try {
    const vid = app.viewAs?.id || app.user.id;
    [d, hp, assets, cos] = await Promise.all([dojoData(true), loadHero(vid), heroAssets().catch(() => []), cosmetics(vid).catch(() => cos)]);
  } catch (e) { body.innerHTML = `<div class="nd-card">${esc(e.message)}</div>`; return; }
  const ctx = heroContext(d); ctx.cosmetics = cos.owned;
  const inv = inventory(ctx);
  const stage = d.rk.rank;
  const equipped = validEquip(hp.equipped, inv, ctx);
  for (const k of ['title', 'frame']) if (hp.equipped?.[k] && cos.owned.has(hp.equipped[k])) equipped[k] = hp.equipped[k];   // v3.1 cosmetic slots
  S = { d, ctx, inv, stage, equipped, assets, hp, viewing, cos };
  initSeen();
  const fresh = inv.filter(isNew).length;
  const titleName = cos.items.find(i => i.key === equipped.title)?.name;
  const st = stats(d, ctx), lv = ctx.lv;
  const rk = RANKS[stage], next = RANKS[stage + 1];
  const name = viewing ? (app.viewAs.name || 'Mikha').split(' ')[0] : firstName();

  body.innerHTML = `<div class="nd-stack">
    <div class="row between"><div><button class="nd-link" data-nav="#/dojo">‹ Dojo</button><div class="nd-label">${viewing ? 'Dad\'s view · read-only' : 'Hero profile'}</div></div></div>
    <div class="hp-grid">
      <div class="hp-stage" style="--belt:${rk.color}">
        <div class="herostage" id="herostage" role="img" aria-label="${esc(name)}'s hero, ${esc(rk.name)} stage">
          <div class="hs-static">${heroPic({ stage }, { w: 300, h: 450 })}</div>
        </div>
        <div class="hp-plate"><div><span class="belt-chip" style="--belt:${rk.color}"><i></i>${esc(rk.belt)} · Stage ${stage + 1}/8</span><div class="nm" style="margin-top:8px">${esc(name)}</div><div class="ttl">${esc(rk.name)}</div>${titleName ? `<div class="htitle">“${esc(titleName)}”</div>` : ''}</div>
          <div class="hp-lv"><div><small>LV</small><b>${lv.level}</b></div></div></div>
        <div class="hp-foot">
          <div class="row between"><span class="nd-label">Level ${lv.level} · ${esc(lv.tier)}</span><span class="nd-label nd-num">${fmtNum(ctx.xp)} XP</span></div>
          <div class="nd-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${lv.pct}" aria-label="XP to next level"><i id="xpfill" style="--p:0%"></i></div>
          <div class="row between" style="align-items:center"><span class="nd-sub nd-num" style="font-size:12.5px">${fmtNum(lv.toNext)} XP to Level ${lv.level + 1}</span>${viewing ? '' : '<button class="nd-btn small" id="cheer">✨ Celebrate</button>'}</div>
        </div>
      </div>
      <div class="nd-stack" style="gap:16px;min-width:0">
        <div class="stat-row">
          <div class="nd-card stat"><div class="nd-label">Power</div><div class="v" id="hpow">${heroPower(equipped, inv)}</div><div class="nd-sub" style="font-size:11.5px">equipped gear</div></div>
          <div class="nd-card stat"><div class="nd-label">Focus</div><div class="v">${st.focus}%</div><div class="nd-sub" style="font-size:11.5px">avg last 30</div></div>
          <div class="nd-card stat"><div class="nd-label">Spirit</div><div class="v">${st.spirit}</div><div class="nd-sub" style="font-size:11.5px">best streak</div></div>
        </div>
        <div class="nd-tabs" role="tablist">${[['gear', 'Gear'], ['loot', `Loot ${inv.filter(i => i.owned).length}/${inv.length}${fresh ? ` <span class="tnew">${fresh} new</span>` : ''}`], ['chest', `Chest ${cos.items.filter(i => i.kind !== 'weapon' && cos.owned.has(i.key)).length}/${cos.items.filter(i => i.kind !== 'weapon').length}`], ['mastery', 'Mastery'], ['evolve', 'Evolution']].map(([k, l]) => `<button role="tab" class="${heroTab === k ? 'on' : ''}" data-tab2="${k}">${l}</button>`).join('')}</div>
        <div id="hp-tab"></div>
      </div>
    </div>
  </div>`;
  body.dataset.ready = '1';
  renderTab();
  requestAnimationFrame(() => requestAnimationFrame(() => { const f = $('#xpfill'); if (f) f.style.setProperty('--p', lv.pct + '%'); }));
  $$('[data-tab2]', body).forEach(b => b.onclick = () => { heroTab = b.dataset.tab2; $$('[data-tab2]', body).forEach(x => x.classList.toggle('on', x === b)); renderTab(); });

  // runtime stage (PixiJS); the static SVG stays if WebGL/WebGPU is unavailable
  const host = $('#herostage');
  const so = stageObj = new (await import('../hero/stage.js')).HeroStage(host);
  try {
    await so.init();
    if (so.dead) return;
    const seenStage = hp.seen_stage, seenLevel = hp.seen_level;
    const evolveFrom = !viewing && seenStage != null && seenStage >= 0 && seenStage < stage ? seenStage : null;
    await so.setLook(lookFor(evolveFrom ?? stage, equipped, assets));
    host.querySelector('.hs-static')?.remove();
    if (evolveFrom != null) {
      toast(`Evolution! You became ${rk.name}.`, 3000);
      await so.evolve(lookFor(stage, equipped, assets));
    } else if (!viewing && seenLevel != null && seenLevel < lv.level) {
      toast(`Level ${lv.level}!`, 2200); so.celebrate();
    }
    if (!viewing && (seenStage !== stage || seenLevel !== lv.level || JSON.stringify(hp.equipped) !== JSON.stringify(equipped))) saveHero({ equipped, seenStage: stage, seenLevel: lv.level }).catch(() => {});
  } catch (e) { console.warn('hero stage', e); }

  $('#cheer') && ($('#cheer').onclick = () => stageObj?.celebrate(0xFFD233));
}

function renderTab() {
  const el = $('#hp-tab'); if (!el) return;
  if (heroTab === 'gear') el.innerHTML = gearHTML();
  else if (heroTab === 'loot') el.innerHTML = lootHTML();
  else if (heroTab === 'mastery') el.innerHTML = masteryHTML();
  else if (heroTab === 'chest') el.innerHTML = chestHTML();
  else el.innerHTML = evolveHTML();
  $$('[data-item]', el).forEach(b => b.onclick = () => openItem(b.dataset.item));
  $$('[data-cos]', el).forEach(b => b.onclick = () => equipCosmetic(b.dataset.kind, b.dataset.cos));
  const tr = $('#trade', el); if (tr) tr.onclick = trade;
  $$('[data-sf]', el).forEach(b => b.onclick = () => { slotFilter = b.dataset.sf; renderTab(); });
  const ep = $('#evoprev', el);
  if (ep) ep.onclick = async () => {
    const next = RANKS[S.stage + 1]; if (!stageObj?.app || !next) return; ep.disabled = true;
    await stageObj.evolve(lookFor(S.stage + 1, S.equipped, S.assets));
    await new Promise(r => setTimeout(r, 1600));
    if (currentRoute()?.name === 'hero' && stageObj) await stageObj.setLook(lookFor(S.stage, S.equipped, S.assets), { animate: 'equip' });
    ep.disabled = false;
  };
}

function gearHTML() {
  const { ctx, equipped, inv } = S;
  const sockets = SLOTS.map(s => {
    const open = slotOpen(ctx, s.key), it = inv.find(i => i.key === equipped[s.key]);
    return `<div class="sock ${open ? (it ? 'filled' : '') : 'locked'}" style="--rc:${it ? RARITY[it.rarity].color : 'transparent'}" ${it ? `data-item="${it.key}" role="button" tabindex="0"` : ''}>
      <b>${s.name}</b><div class="ic">${open ? (it ? itemIcon(it, 58) : '<span class="nd-sub">Empty</span>') : '🔒'}</div>
      <span>${open ? (it ? esc(it.name) : 'Choose in Loot') : `Opens at Level ${s.level}`}</span>${it ? `<span class="nd-pill" style="--c:${RARITY[it.rarity].color}"><span class="dot"></span>${RARITY[it.rarity].name} · ${powerOf(it)}</span>` : ''}</div>`;
  }).join('');
  const best = inv.filter(i => i.owned && slotOpen(ctx, i.slot) && equipped[i.slot] !== i.key).sort((a, b) => RARITY[b.rarity].n - RARITY[a.rarity].n).slice(0, 3);
  return `<div class="nd-stack" style="gap:14px">
    <div class="nd-card"><div class="nd-sec" style="margin-top:0"><div class="nd-h2">Equipped</div><span class="nd-sub">Tap Loot to swap</span></div><div class="doll">${sockets}</div></div>
    ${best.length ? `<div><div class="nd-sec"><div class="nd-h2" style="font-size:18px">Ready to try</div></div><div class="loot">${best.map(i => lootCard(i)).join('')}</div></div>` : ''}
  </div>`;
}

/* v3.4 "NEW" badges: items owned since the last visit (per viewer, local only; first visit marks everything seen) */
const seenKey = () => `mls_seen_items_${app.viewAs?.id || app.user?.id || 'x'}`;
function seenSet() {
  try { const v = localStorage.getItem(seenKey()); return v ? new Set(JSON.parse(v)) : null; } catch { return new Set(); }
}
function saveSeen(set) { try { localStorage.setItem(seenKey(), JSON.stringify([...set])); } catch { /* private mode */ } }
function initSeen() {
  let s = seenSet();
  if (!s) { s = new Set(S.inv.filter(i => i.owned).map(i => i.key)); saveSeen(s); }
  S.seen = s;
}
const isNew = (it) => it.owned && S.seen && !S.seen.has(it.key);
function markSeen(key) { if (!S.seen || S.seen.has(key)) return; S.seen.add(key); saveSeen(S.seen); }
/** strongest owned item per slot */
function bestBySlot() {
  const best = {};
  for (const i of S.inv) if (i.owned && (!best[i.slot] || powerOf(i) > powerOf(best[i.slot]))) best[i.slot] = i;
  return best;
}
const stars = (rar) => `<span class="lstars" aria-label="${STARS[rar]} of 5 stars">${'★'.repeat(STARS[rar])}<i>${'★'.repeat(5 - STARS[rar])}</i></span>`;

function lootCard(it, best = bestBySlot()) {
  const { equipped, ctx, viewing } = S;
  const r = RARITY[it.rarity], on = equipped[it.slot] === it.key, open = slotOpen(ctx, it.slot), slot = SLOTS.find(s => s.key === it.slot);
  const ef = effectOf(it), top = it.owned && best[it.slot]?.key === it.key && !on;
  return `<button class="lcard r-${it.rarity} ${it.owned ? '' : 'locked'} ${on ? 'on' : ''}" data-item="${it.key}" style="--rc:${r.color}" ${!it.owned || viewing ? 'aria-disabled="true"' : ''}>
    <div class="in"><div class="art">${itemIcon(it, 96)}${it.owned ? '<i class="gem"></i>' : ''}<span class="lpow num" title="Power">⚡${powerOf(it)}</span>${stars(it.rarity)}
      ${isNew(it) ? '<span class="lnew">NEW</span>' : top ? '<span class="lbest">BEST</span>' : ''}${it.rarity === 'legendary' || it.rarity === 'epic' ? '<i class="lshine" aria-hidden="true"></i>' : ''}</div>
    <div class="tx"><div class="rr">${r.name} · ${esc(slot.name)}</div><div class="nm">${esc(it.name)}</div>
    ${ef.short ? `<div class="lef">${ef.short}</div>` : ''}
    <div class="st">${it.owned ? (on ? '✓ Equipped' : open ? 'Tap for details' : `Slot opens at Level ${slot.level}`) : '🔒 ' + esc(it.hint)}</div></div></div></button>`;
}

function lootHTML() {
  const { inv } = S;
  const best = bestBySlot();
  const list = inv.filter(i => slotFilter === 'all' || i.slot === slotFilter)
    .sort((a, b) => (b.owned - a.owned) || (powerOf(b) - powerOf(a)));
  return `<div class="nd-stack" style="gap:12px">
    <div class="nd-chips">${[['all', 'All'], ...SLOTS.map(s => [s.key, s.name])].map(([k, l]) => `<button class="nd-chip plain ${k === slotFilter ? 'on' : ''}" data-sf="${k}">${l}</button>`).join('')}</div>
    <div class="loot">${list.map(i => lootCard(i, best)).join('')}</div>
    <p class="nd-sub" style="font-size:12px">Loot comes from levels, sealing 2/4/all bosses of a family, gate exams and chests. Rarity: Bronze → Silver → Gold → Epic → Legendary. Power shows which item is stronger; bonuses only work in the Survival Tower. Tap an item for details.</p>
  </div>`;
}

function masteryHTML() {
  const { d } = S;
  return `<div class="paths">${d.cat.subjects.map(s => {
    const list = d.bosses.filter(b => b.ch.subject_id === s.id);
    if (!list.length) return '';
    const m = list[0].m, f = FAMILIES[list[0].fam];
    const cards = list.filter(b => b.beaten).length, titles = BRANCH_TITLES[m.key] || ['Adept', 'Sage'];
    const earned = cards >= 6 ? titles[1] : cards >= 3 ? titles[0] : null;
    let track = '';
    list.forEach((b, i) => {
      if (i) track += `<span class="seg ${b.beaten && list[i - 1].beaten ? 'lit' : ''}"></span>`;
      track += `<span class="node2 ${b.beaten ? 'lit t-' + cardTier(b.beaten.best_accuracy) : ''}" title="${esc(shortCode(b.ch.code))} ${esc(b.ch.name)}${b.beaten ? ' · ' + esc(b.tech) : ''}">${esc(shortCode(b.ch.code))}</span>`;
      if (i === 2 || i === 5) track += `<span class="seg ${cards > i ? 'lit' : ''}"></span><span class="gatepin ${cards >= i + 1 ? 'got' : ''}" title="${esc(titles[i === 2 ? 0 : 1])}"><i></i>${i === 2 ? 'I' : 'II'}</span>`;
    });
    return `<div class="nd-card path" style="--fc:${f.c}"><div class="hd">${familyEmblem(list[0].fam, 36)}<div style="flex:1;min-width:0"><b>${esc(m.short)}</b> <span class="nd-sub" style="font-size:12px">· ${esc(f.name)}</span>
      <div class="nd-sub" style="font-size:12px">${earned ? `🏅 Title: <b style="color:var(--nd-gold)">${esc(earned)}</b>` : `${cards}/3 cards to <b>${esc(titles[0])}</b>`}</div></div><span class="nd-sub nd-num">${cards}/${list.length}</span></div>
      <div class="track">${track}</div></div>`;
  }).join('')}<p class="nd-sub" style="font-size:12px">Every chapter is a node. Seal its guardian to earn its technique card; the node glows Bronze, Silver or Gold. Gates I and II give a title.</p></div>`;
}

function evolveHTML() {
  const { stage, equipped, d, viewing } = S;
  const rk = RANKS[stage], next = RANKS[stage + 1];
  return `<div class="nd-card">
    <div class="nd-sec" style="margin-top:0"><div class="nd-h2">Evolution</div><span class="nd-sub">Stage ${stage + 1} of 8</span></div>
    ${next ? `<div class="evo2"><div class="pane">${heroPic({ stage }, { w: 150, h: 225 })}<span class="nd-label">${esc(rk.name)}</span></div><div class="arrow">→</div>
      <div class="pane next">${heroPic({ stage: stage + 1 }, { w: 150, h: 225 })}<span class="nd-label" style="color:var(--nd-gold)">${esc(next.name)}</span></div></div>
      <p class="nd-sub" style="margin-top:10px">${esc(next.belt)}: new outfit${stage + 1 >= 3 ? ', guards' : ''}${stage + 1 >= 4 ? ', haori' : ''}${stage + 1 >= 5 ? ', cape' : ''}${stage + 1 >= 6 ? ', armor' : ''}${stage + 1 === 7 ? ', crown of light' : ''}.
      ${d.rk.ready ? `The gate is open: pass with ${d.R.pass}% to evolve.` : `Seal ${d.rk.need - d.rk.have} more boss${d.rk.need - d.rk.have === 1 ? '' : 'es'}, then beat the Exam Gate Boss.`}</p>
      <div class="row" style="gap:8px;margin-top:12px;flex-wrap:wrap"><button class="nd-btn small" id="evoprev">▶ Preview evolution</button>${!viewing && d.rk.ready && !d.triedToday ? '<button class="nd-btn small primary" data-nav="#/dojo">Challenge the gate →</button>' : ''}</div>`
    : '<p class="nd-sub">Final form reached. Keep every seal strong!</p>'}
    <div class="belts" style="margin-top:16px">${RANKS.map((r, i) => `<span class="${i < stage ? 'past' : i === stage ? 'now' : ''}" style="--belt:${r.color === '#1B1826' ? '#3A3550' : r.color}" title="${esc(r.name)}"></span>`).join('')}</div>
  </div>`;
}

/* ---- v3.1 chest collection: titles, card frames, shards (auras live in Loot/Gear) ---- */
const CR = { common: ['Common', '#B8C2D0'], rare: ['Rare', '#3987e5'], epic: ['Epic', '#B9A6FF'], legendary: ['Legendary', '#FF8A3D'] };
function chestHTML() {
  const { cos, equipped, viewing } = S;
  const kind = (k) => cos.items.filter(i => i.kind === k);
  const card = (i) => { const own = cos.owned.has(i.key), on = equipped[i.kind] === i.key, [rn, rc] = CR[i.rarity];
    const pv = i.kind === 'frame' ? `<span class="ci-frame" style="--c1:${esc(i.data?.c1 || '#fff')};--c2:${esc(i.data?.c2 || '#333')}">?</span>`
      : i.kind === 'aura' ? `<span class="ci-aura" style="--ac:${esc(i.data?.color || '#fff')}"></span>` : '';
    return `<button class="cos ${own ? '' : 'locked'} ${on ? 'on' : ''}" style="--rc:${rc}" ${own && !viewing && i.kind !== 'aura' ? `data-cos="${i.key}" data-kind="${i.kind}"` : 'aria-disabled="true"'}>
      ${pv}<div class="tx"><span class="rr" style="color:${rc}">${rn}</span><b ${i.kind === 'title' && own ? 'class="ci-title sm"' : ''}>${own ? (i.kind === 'title' ? `“${esc(i.name)}”` : esc(i.name)) : '???'}</b><span class="st">${own ? (i.kind === 'aura' ? 'Equip in Gear' : on ? '✓ Equipped' : 'Tap to equip') : i.rarity === 'legendary' ? '🔒 Tower' : '🔒 Chest'}</span></div></button>`; };
  return `<div class="nd-stack" style="gap:14px">
    <div class="nd-card"><div class="row between"><div><div class="nd-h2" style="font-size:18px">Shards</div><div class="nd-sub" style="font-size:12px">Duplicates from chests. 10 shards = pick any item.</div></div><b class="shards num">💎 ${cos.shards}/10</b></div>
      ${!viewing && cos.shards >= 10 ? '<button class="nd-btn primary block" id="trade" style="margin-top:10px">Trade 10 shards →</button>' : ''}</div>
    <div><div class="nd-sec"><div class="nd-h2" style="font-size:18px">Titles</div><span class="nd-sub">${kind('title').filter(i => cos.owned.has(i.key)).length}/${kind('title').length}</span></div><div class="cosgrid">${kind('title').map(card).join('')}</div></div>
    <div><div class="nd-sec"><div class="nd-h2" style="font-size:18px">Card frames</div><span class="nd-sub">for the Monster Dex</span></div><div class="cosgrid">${kind('frame').map(card).join('')}</div></div>
    <div><div class="nd-sec"><div class="nd-h2" style="font-size:18px">Chest auras</div><span class="nd-sub">${kind('aura').filter(i => cos.owned.has(i.key)).length}/${kind('aura').length}</span></div><div class="cosgrid">${kind('aura').map(card).join('')}</div></div>
    <p class="nd-sub" style="font-size:12px">Every finished round of 10 gives one chest. More stars, better odds: 0–1★ Common 80% · Rare 18% · Epic 2%; 2★ 60/32/8; 3★ always Epic.</p>
  </div>`;
}
function equipCosmetic(kind, key) {
  if (S.viewing) return;
  const eq = { ...S.equipped };
  if (eq[kind] === key) delete eq[kind]; else eq[kind] = key;
  S.equipped = eq; renderTab();
  const t = S.cos.items.find(i => i.key === eq.title)?.name, plate = document.querySelector('.hp-plate .htitle');
  if (kind === 'title') { if (plate) plate.textContent = t ? `“${t}”` : ''; else if (t) document.querySelector('.hp-plate .ttl')?.insertAdjacentHTML('afterend', `<div class="htitle">“${esc(t)}”</div>`); }
  clearTimeout(saveT);
  saveT = setTimeout(() => saveHero({ equipped: eq }).catch(e => toast(e.message, 2500)), 600);
}
async function trade() {
  const { cos } = S, open = cos.items.filter(i => !cos.owned.has(i.key) && i.rarity !== 'legendary');   // legendary only from the Tower
  if (!open.length) { toast('You own everything already!', 2000); return; }
  const v = await sheet({ title: 'Pick an item (10 shards)', body: '', actions: [...open.map(i => ({ label: `${CR[i.rarity][0]} · ${i.name} (${i.kind})`, value: i.key })), { label: 'Cancel', value: null }] });
  if (!v) return;
  try { const r = await redeemShards(v); cos.owned.add(v); cos.shards = r.shards; S.ctx.cosmetics = cos.owned; S.inv = inventory(S.ctx); toast(`✨ ${r.item.name} is yours!`, 2200); renderTab(); }
  catch (e) { toast(e.message, 2600); }
}

/* ---- v3.4 item card: story, Power, Tower effect, compare with the equipped item ---- */
function openItem(key) {
  const { inv, equipped, ctx, viewing } = S;
  const it = inv.find(i => i.key === key); if (!it) return;
  const wasNew = isNew(it);
  if (wasNew) { markSeen(key); const left = S.inv.filter(isNew).length, t = document.querySelector('[data-tab2="loot"] .tnew'); if (t) { if (left) t.textContent = `${left} new`; else t.remove(); } }
  const r = RARITY[it.rarity], slot = SLOTS.find(s => s.key === it.slot), pw = powerOf(it), ef = effectOf(it);
  const cur = inv.find(i => i.key === equipped[it.slot]), same = cur?.key === it.key;
  const d = cur && !same ? pw - powerOf(cur) : null;
  const open = slotOpen(ctx, it.slot);
  const canEquip = it.owned && open && !viewing && !(same && it.slot === 'weapon');
  const col = (x, lab, cls) => `<div class="icol ${cls}"><span class="nd-label">${lab}</span><b>${esc(x.name)}</b><span class="irr" style="--rc:${RARITY[x.rarity].color}">${RARITY[x.rarity].name}</span><div class="ipw"><b class="num">${powerOf(x)}</b><small>POWER</small></div><span class="ief">${esc(effectOf(x).text)}</span></div>`;
  const wrap = document.createElement('div');
  wrap.className = 'isheet nd'; wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-modal', 'true'); wrap.setAttribute('aria-label', it.name);
  const fancy = it.rarity === 'legendary' || it.rarity === 'epic';
  const peers = inv.filter(i => i.slot === it.slot).sort((a, b) => powerOf(b) - powerOf(a)), rank = peers.findIndex(i => i.key === it.key) + 1;
  wrap.innerHTML = `<div class="ipanel r-${it.rarity} ${wasNew ? 'reveal' : ''} ${it.owned ? '' : 'locked'}" style="--rc:${r.color}">
    ${fancy ? '<div class="irays" aria-hidden="true"></div>' : ''}
    <button class="ix" data-x aria-label="Close">✕</button>
    <div class="ihead"><div class="iart">${itemIcon(it, 120)}${fancy ? '<i class="isp s1"></i><i class="isp s2"></i><i class="isp s3"></i><i class="isp s4"></i>' : ''}</div>
      ${wasNew ? '<span class="inew">✨ NEW ITEM!</span>' : ''}
      <span class="irr" style="--rc:${r.color}">${stars(it.rarity)} ${r.name} · ${esc(slot.name)}</span><div class="inm">${esc(it.name)}</div>
      <p class="ids">${esc(DESC[it.key] || 'A piece of gear for your hero.')}</p>
      <span class="irank">${rank === 1 ? `👑 Strongest ${esc(slot.name.toLowerCase())} in the game` : `#${rank} of ${peers.length} ${esc(slot.name.toLowerCase())}s by Power`}</span></div>
    <div class="nd-card ibox"><div class="row between" style="align-items:flex-end"><div class="ipw big"><b class="num">${pw}</b><small>POWER</small></div>
      ${d != null ? `<span class="idelta ${d > 0 ? 'up' : d < 0 ? 'down' : ''}">${d > 0 ? '▲ +' + d : d < 0 ? '▼ ' + d : '= same'} vs your ${esc(slot.name.toLowerCase())}</span>` : same ? '<span class="idelta">✓ Equipped now</span>' : ''}</div>
      <div class="nd-bar" style="margin:8px 0 10px"><i style="--p:${Math.min(100, pw)}%"></i></div>
      <div class="ief"><b>Tower effect:</b> ${esc(ef.text)}</div>
      ${ef.cut || ef.guard || ef.focus || ef.lastStand ? `<div class="ief dim">${[ef.focus && SKILL_HELP.focus, ef.cut && SKILL_HELP.cut, ef.guard && SKILL_HELP.guard, ef.lastStand && SKILL_HELP.lastStand].filter(Boolean).map(esc).join(' ')}</div>` : ''}
      <div class="ief dim">${it.owned ? '✓ You own this' : '🔒 ' + esc(it.hint)}</div></div>
    ${cur && !same ? `<div class="icmp">${col(cur, 'Equipped', '')}${col(it, it.owned ? 'This item' : 'Locked', 'new')}</div>` : ''}
    ${canEquip ? `<button class="nd-btn primary block" data-eq>${same ? 'Take off' : 'Equip ' + esc(it.name)}</button>`
      : !it.owned ? '' : !open ? `<p class="nd-sub" style="text-align:center">The ${esc(slot.name.toLowerCase())} slot opens at Level ${slot.level}.</p>` : ''}
  </div>`;
  const close = (eq) => { wrap.remove(); document.removeEventListener('keydown', onKey); if (wasNew && !eq) renderTab(); };
  const onKey = (e) => { if (e.key === 'Escape') close(); };
  wrap.addEventListener('click', e => {
    if (e.target === wrap || e.target.closest('[data-x]')) close();
    else if (e.target.closest('[data-eq]')) { sfx.shield(); close(true); equip(key); }
  });
  if (wasNew) (it.rarity === 'legendary' || it.rarity === 'epic' ? sfx.chest(it.rarity) : sfx.star(STARS[it.rarity]));
  else sfx.tap();
  document.addEventListener('keydown', onKey);
  $('#app').appendChild(wrap);
  wrap.querySelector('[data-eq], [data-x]')?.focus();
}

async function equip(key) {
  const { inv, ctx, viewing } = S;
  if (viewing) return;
  const it = inv.find(i => i.key === key);
  if (!it?.owned) { toast(it?.hint || 'Locked', 2000); return; }
  if (!slotOpen(ctx, it.slot)) { toast(`The ${it.slot} slot opens at Level ${SLOTS.find(s => s.key === it.slot).level}.`, 2400); return; }
  const eq = { ...S.equipped };
  if (eq[it.slot] === key && it.slot !== 'weapon') delete eq[it.slot]; else eq[it.slot] = key;
  S.equipped = eq;
  renderTab();
  const hpw = $('#hpow'); if (hpw) hpw.textContent = heroPower(eq, inv);
  if (stageObj?.app) stageObj.setLook(lookFor(S.stage, eq, S.assets), { animate: 'equip' });
  clearTimeout(saveT);
  saveT = setTimeout(() => saveHero({ equipped: eq }).catch(e => toast(e.message, 2500)), 600);
}

/** Leaving the screen stops the renderer (router calls this on hash change). */
export function leaveHero() { stageObj?.destroy(); stageObj = null; }
window.addEventListener('hashchange', () => { if (!/^#\/hero/.test(location.hash)) leaveHero(); });
