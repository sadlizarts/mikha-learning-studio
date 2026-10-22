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
    const c = '#' + (AURAS[it.key]?.color ?? 0xffffff).toString(16).padStart(6, '0');
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
          <div class="nd-card stat"><div class="nd-label">Power</div><div class="v">${st.power}</div><div class="nd-sub" style="font-size:11.5px">card tiers</div></div>
          <div class="nd-card stat"><div class="nd-label">Focus</div><div class="v">${st.focus}%</div><div class="nd-sub" style="font-size:11.5px">avg last 30</div></div>
          <div class="nd-card stat"><div class="nd-label">Spirit</div><div class="v">${st.spirit}</div><div class="nd-sub" style="font-size:11.5px">best streak</div></div>
        </div>
        <div class="nd-tabs" role="tablist">${[['gear', 'Gear'], ['loot', `Loot ${inv.filter(i => i.owned).length}/${inv.length}`], ['chest', `Chest ${cos.owned.size}/${cos.items.length}`], ['mastery', 'Mastery'], ['evolve', 'Evolution']].map(([k, l]) => `<button role="tab" class="${heroTab === k ? 'on' : ''}" data-tab2="${k}">${l}</button>`).join('')}</div>
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
  $$('[data-item]', el).forEach(b => b.onclick = () => equip(b.dataset.item));
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
    return `<div class="sock ${open ? (it ? 'filled' : '') : 'locked'}" style="--rc:${it ? RARITY[it.rarity].color : 'transparent'}">
      <b>${s.name}</b><div class="ic">${open ? (it ? itemIcon(it, 58) : '<span class="nd-sub">Empty</span>') : '🔒'}</div>
      <span>${open ? (it ? esc(it.name) : 'Choose in Loot') : `Opens at Level ${s.level}`}</span>${it ? `<span class="nd-pill" style="--c:${RARITY[it.rarity].color}"><span class="dot"></span>${RARITY[it.rarity].name}</span>` : ''}</div>`;
  }).join('');
  const best = inv.filter(i => i.owned && slotOpen(ctx, i.slot) && equipped[i.slot] !== i.key).sort((a, b) => RARITY[b.rarity].n - RARITY[a.rarity].n).slice(0, 3);
  return `<div class="nd-stack" style="gap:14px">
    <div class="nd-card"><div class="nd-sec" style="margin-top:0"><div class="nd-h2">Equipped</div><span class="nd-sub">Tap Loot to swap</span></div><div class="doll">${sockets}</div></div>
    ${best.length ? `<div><div class="nd-sec"><div class="nd-h2" style="font-size:18px">Ready to try</div></div><div class="loot">${best.map(lootCard).join('')}</div></div>` : ''}
  </div>`;
}

function lootCard(it) {
  const { equipped, ctx, viewing } = S;
  const r = RARITY[it.rarity], on = equipped[it.slot] === it.key, open = slotOpen(ctx, it.slot), slot = SLOTS.find(s => s.key === it.slot);
  return `<button class="lcard r-${it.rarity} ${it.owned ? '' : 'locked'} ${on ? 'on' : ''}" data-item="${it.key}" style="--rc:${r.color}" ${!it.owned || viewing ? 'aria-disabled="true"' : ''}>
    <div class="in"><div class="art">${itemIcon(it, 96)}${it.owned ? '<i class="gem"></i>' : ''}</div>
    <div class="tx"><div class="rr">${r.name} · ${esc(slot.name)}</div><div class="nm">${esc(it.name)}</div>
    <div class="st">${it.owned ? (on ? '✓ Equipped' : open ? 'Tap to equip' : `Slot opens at Level ${slot.level}`) : '🔒 ' + esc(it.hint)}</div></div></div></button>`;
}

function lootHTML() {
  const { inv } = S;
  const list = inv.filter(i => slotFilter === 'all' || i.slot === slotFilter);
  return `<div class="nd-stack" style="gap:12px">
    <div class="nd-chips">${[['all', 'All'], ...SLOTS.map(s => [s.key, s.name])].map(([k, l]) => `<button class="nd-chip plain ${k === slotFilter ? 'on' : ''}" data-sf="${k}">${l}</button>`).join('')}</div>
    <div class="loot">${list.map(lootCard).join('')}</div>
    <p class="nd-sub" style="font-size:12px">Loot comes from levels, sealing 2/4/all bosses of a family, and passing gate exams. Rarity: Bronze → Silver → Gold → Epic → Legendary.</p>
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
const CR = { common: ['Common', '#B8C2D0'], rare: ['Rare', '#3987e5'], epic: ['Epic', '#B9A6FF'] };
function chestHTML() {
  const { cos, equipped, viewing } = S;
  const kind = (k) => cos.items.filter(i => i.kind === k);
  const card = (i) => { const own = cos.owned.has(i.key), on = equipped[i.kind] === i.key, [rn, rc] = CR[i.rarity];
    const pv = i.kind === 'frame' ? `<span class="ci-frame" style="--c1:${esc(i.data?.c1 || '#fff')};--c2:${esc(i.data?.c2 || '#333')}">?</span>`
      : i.kind === 'aura' ? `<span class="ci-aura" style="--ac:${esc(i.data?.color || '#fff')}"></span>` : '';
    return `<button class="cos ${own ? '' : 'locked'} ${on ? 'on' : ''}" style="--rc:${rc}" ${own && !viewing && i.kind !== 'aura' ? `data-cos="${i.key}" data-kind="${i.kind}"` : 'aria-disabled="true"'}>
      ${pv}<div class="tx"><span class="rr" style="color:${rc}">${rn}</span><b ${i.kind === 'title' && own ? 'class="ci-title sm"' : ''}>${own ? (i.kind === 'title' ? `“${esc(i.name)}”` : esc(i.name)) : '???'}</b><span class="st">${own ? (i.kind === 'aura' ? 'Equip in Gear' : on ? '✓ Equipped' : 'Tap to equip') : '🔒 Chest'}</span></div></button>`; };
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
  const { cos } = S, open = cos.items.filter(i => !cos.owned.has(i.key));
  if (!open.length) { toast('You own everything already!', 2000); return; }
  const v = await sheet({ title: 'Pick an item (10 shards)', body: '', actions: [...open.map(i => ({ label: `${CR[i.rarity][0]} · ${i.name} (${i.kind})`, value: i.key })), { label: 'Cancel', value: null }] });
  if (!v) return;
  try { const r = await redeemShards(v); cos.owned.add(v); cos.shards = r.shards; S.ctx.cosmetics = cos.owned; S.inv = inventory(S.ctx); toast(`✨ ${r.item.name} is yours!`, 2200); renderTab(); }
  catch (e) { toast(e.message, 2600); }
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
  if (stageObj?.app) stageObj.setLook(lookFor(S.stage, eq, S.assets), { animate: 'equip' });
  clearTimeout(saveT);
  saveT = setTimeout(() => saveHero({ equipped: eq }).catch(e => toast(e.message, 2500)), 600);
}

/** Leaving the screen stops the renderer (router calls this on hash change). */
export function leaveHero() { stageObj?.destroy(); stageObj = null; }
window.addEventListener('hashchange', () => { if (!/^#\/hero/.test(location.hash)) leaveHero(); });
