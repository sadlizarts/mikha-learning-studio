// Hero profile (v1.9.0): animated character, XP bar, equipment, inventory, skill tree, evolution preview.
// One persistent original character; its look comes from Dojo rank (stage) + equipped items. Never regenerated at runtime.
import { $, $$, esc, toast, fmtNum, shortCode } from '../ui.js';
import { loadHero, saveHero, heroAssets } from '../store.js';
import { app, firstName } from '../state.js';
import { show, navigate, currentRoute } from '../router.js';
import { dojoData } from './dojo.js';
import { RANKS, beltSVG, cardTier } from '../dojo.js';
import { heroSVG, itemArt, svgDoc } from '../hero/art.js';
import { RARITY, SLOTS, AURAS, inventory, heroContext, validEquip, slotOpen, stats, itemView, BRANCH_TITLES } from '../hero/items.js';

let stageObj = null, slotFilter = 'all', S = null, saveT = null;

/** Approved AI layers -> runtime look (assets override the placeholder SVG layer by layer). */
function lookFor(stage, equipped, assets) {
  const look = { stage, equipped, assets: {}, anchors: {} };
  const m = assets.find(a => a.kind === 'master');
  if (m?.url) { look.assets.body = m.url; look.assets.hairBack = 'none'; look.assets.hairFront = 'none'; look.anchors.body = m.anchor; }
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
  let d, hp, assets = [];
  const viewing = !!app.viewAs;
  try {
    const vid = app.viewAs?.id || app.user.id;
    [d, hp, assets] = await Promise.all([dojoData(true), loadHero(vid), heroAssets().catch(() => [])]);
  } catch (e) { body.innerHTML = `<div class="panel sunk empty">${esc(e.message)}</div>`; return; }
  const ctx = heroContext(d), inv = inventory(ctx);
  const stage = d.rk.rank;
  const equipped = validEquip(hp.equipped, inv, ctx);
  S = { d, ctx, inv, stage, equipped, assets, hp, viewing };
  const st = stats(d, ctx), lv = ctx.lv;
  const rk = RANKS[stage], next = RANKS[stage + 1];
  const name = viewing ? (app.viewAs.name || 'Mikha').split(' ')[0] : firstName();

  body.innerHTML = `<div class="herogrid">
    <div class="herostage-wrap">
      <div class="herostage" id="herostage" role="img" aria-label="${esc(name)}'s hero, ${esc(rk.name)} stage">
        <div class="hs-static">${heroSVG({ stage, equipped }, { w: 300, h: 450 })}</div>
      </div>
      <div class="hs-top"><div><div class="hs-eyebrow">${esc(rk.belt)} · Stage ${stage + 1}/8</div><div class="hs-name">${esc(name)}</div><div class="hs-title">${esc(rk.name)}</div></div>
        <div class="hs-lv"><span>LV</span><b class="num">${lv.level}</b></div></div>
      <div class="hs-bottom">
        <div class="row between"><span class="hs-eyebrow">Level ${lv.level} · ${esc(lv.tier)}</span><span class="hs-eyebrow num">${fmtNum(ctx.xp)} XP</span></div>
        <div class="xpbar2" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${lv.pct}" aria-label="XP to next level"><i id="xpfill"></i><span class="shine"></span></div>
        <div class="row between note-inv"><span class="num">${fmtNum(lv.toNext)} XP to Level ${lv.level + 1}</span>${viewing ? '' : '<button class="hs-btn" id="cheer">✨ Celebrate</button>'}</div>
      </div>
    </div>
    <div class="stack herocol">
      <div class="statrow3">
        <div class="panel stat3"><div class="eyebrow">Power</div><b class="num">${st.power}</b><span class="note">card tiers</span></div>
        <div class="panel stat3"><div class="eyebrow">Focus</div><b class="num">${st.focus}%</b><span class="note">avg last 30</span></div>
        <div class="panel stat3"><div class="eyebrow">Spirit</div><b class="num">${st.spirit}</b><span class="note">best streak</span></div>
      </div>
      <div class="panel"><div class="eyebrow" style="margin-bottom:10px">Equipment</div><div class="slots" id="slots"></div></div>
      <div class="panel"><div class="row between" style="margin-bottom:8px;flex-wrap:wrap;gap:8px"><div class="eyebrow">Inventory <span class="num">${inv.filter(i => i.owned).length}/${inv.length}</span></div>
        <div class="chips" style="padding:0">${[['all', 'All'], ...SLOTS.map(s => [s.key, s.name])].map(([k, l]) => `<button class="fchip ${k === slotFilter ? 'on' : ''}" data-sf="${k}" style="--c:var(--ink)">${l}</button>`).join('')}</div></div>
        <div class="invgrid" id="invgrid"></div></div>
      <div class="panel evo">
        <div class="eyebrow" style="margin-bottom:8px">Evolution</div>
        ${next ? `<div class="row" style="gap:14px;align-items:center">
          <div class="evo-next">${heroSVG({ stage: stage + 1, equipped }, { w: 96, h: 144 }).replace('<svg ', '<svg class="sil" ')}</div>
          <div class="grow"><div style="font-family:var(--display);font-size:22px;color:var(--ink)">Next: ${esc(next.name)}</div>
            <div class="note">${esc(next.belt)} · new outfit${stage + 1 >= 5 ? ', cape' : ''}${stage + 1 >= 6 ? ', armor' : ''}${stage + 1 === 7 ? ', crown of light' : ''}</div>
            <div class="note" style="margin-top:6px">${d.rk.ready ? `Exam is open: pass ≥ ${d.R.pass}% to evolve.` : `Seal ${d.rk.need - d.rk.have} more boss${d.rk.need - d.rk.have === 1 ? '' : 'es'}, then pass the rank exam.`}</div>
            <div class="row" style="gap:8px;margin-top:10px;flex-wrap:wrap"><button class="btn small" id="evoprev">▶ Preview evolution</button>${!viewing && d.rk.ready && !d.triedToday ? '<button class="btn small primary" data-nav="#/dojo">Go to exam →</button>' : ''}</div></div>
        </div>` : '<p class="note">Final form reached. Keep every seal strong!</p>'}
        <div class="evotrack">${RANKS.map((r, i) => `<span class="${i < stage ? 'past' : i === stage ? 'now' : ''}" style="--belt:${r.color}" title="${esc(r.name)}"></span>`).join('')}</div>
      </div>
      <div class="panel"><div class="eyebrow" style="margin-bottom:10px">Skill tree</div><div class="skilltree" id="skilltree"></div>
        <p class="note" style="margin-top:8px">Each node is a chapter. It lights up with its technique card (Bronze, Silver, Gold). 3 cards and 6 cards in a branch earn a title.</p></div>
      ${viewing ? '<p class="note">Dad\'s view: read-only.</p>' : ''}
    </div>
  </div>`;
  body.dataset.ready = '1';
  renderSlots(); renderInv(); renderTree();
  requestAnimationFrame(() => { const f = $('#xpfill'); if (f) { f.style.width = '0%'; requestAnimationFrame(() => { f.style.width = lv.pct + '%'; }); } });

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
  $('#evoprev') && ($('#evoprev').onclick = async (e) => {
    const b = e.currentTarget; if (!stageObj?.app || !next) return; b.disabled = true;
    await stageObj.evolve(lookFor(stage + 1, S.equipped, S.assets));
    await new Promise(r => setTimeout(r, 1600));
    if (currentRoute()?.name === 'hero' && stageObj) await stageObj.setLook(lookFor(stage, S.equipped, S.assets), { animate: 'equip' });
    b.disabled = false;
  });
  $$('[data-sf]', body).forEach(b => b.onclick = () => { slotFilter = b.dataset.sf; $$('[data-sf]', body).forEach(x => x.classList.toggle('on', x === b)); renderInv(); });
}

function renderSlots() {
  const { ctx, equipped, inv } = S;
  $('#slots').innerHTML = SLOTS.map(s => {
    const open = slotOpen(ctx, s.key), it = inv.find(i => i.key === equipped[s.key]);
    return `<div class="slot ${open ? '' : 'locked'}" style="--r:${it ? RARITY[it.rarity].color : 'var(--line)'}">
      <div class="sic">${open ? (it ? itemIcon(it, 54) : '<span class="note">Empty</span>') : '🔒'}</div>
      <div class="sname">${s.name}</div><div class="note">${open ? (it ? esc(it.name) : 'Tap an item') : `Level ${s.level}`}</div></div>`;
  }).join('');
}

function renderInv() {
  const { inv, equipped, ctx, viewing } = S;
  const list = inv.filter(i => slotFilter === 'all' || i.slot === slotFilter);
  $('#invgrid').innerHTML = list.map(it => {
    const r = RARITY[it.rarity], on = equipped[it.slot] === it.key, open = slotOpen(ctx, it.slot);
    return `<button class="icard ${it.owned ? '' : 'locked'} ${on ? 'on' : ''} r-${it.rarity}" data-item="${it.key}" style="--r:${r.color}" ${!it.owned || viewing ? 'aria-disabled="true"' : ''}>
      <div class="iic">${it.owned ? itemIcon(it, 64) : `<div class="isil">${itemIcon(it, 64)}</div>`}</div>
      <b>${esc(it.name)}</b><span class="rar">${r.name} · ${esc(SLOTS.find(s => s.key === it.slot).name)}</span>
      <span class="note">${it.owned ? (on ? 'Equipped' : open ? 'Tap to equip' : `Slot opens at Level ${SLOTS.find(s => s.key === it.slot).level}`) : esc(it.hint)}</span></button>`;
  }).join('');
  $$('#invgrid [data-item]').forEach(b => b.onclick = () => equip(b.dataset.item));
}

function renderTree() {
  const { d, ctx } = S;
  const subs = d.cat.subjects;
  $('#skilltree').innerHTML = subs.map(s => {
    const list = d.bosses.filter(b => b.ch.subject_id === s.id);
    const m = list[0]?.m; if (!m) return '';
    const cards = list.filter(b => b.beaten).length, titles = BRANCH_TITLES[m.key] || ['Adept', 'Sage'];
    const earned = cards >= 6 ? titles[1] : cards >= 3 ? titles[0] : null;
    return `<div class="branch" style="--c:${m.color}">
      <div class="bhead"><b>${esc(m.short)}</b><span class="note">${earned ? '🏅 ' + esc(earned) : `${cards}/3 to ${esc(titles[0])}`}</span></div>
      <div class="nodes">${list.map((b, i) => `${i ? '<i class="link ' + (b.beaten && list[i - 1].beaten ? 'lit' : '') + '"></i>' : ''}<span class="node ${b.beaten ? 'lit t-' + cardTier(b.beaten.best_accuracy) : ''}" title="${esc(shortCode(b.ch.code))} ${esc(b.ch.name)}${b.beaten ? ' · ' + esc(b.tech) : ''}">${esc(shortCode(b.ch.code))}</span>${i === 2 || i === 5 ? `<span class="mile ${cards >= i + 1 ? 'got' : ''}" title="${i === 2 ? esc(titles[0]) : esc(titles[1])}">★</span>` : ''}`).join('')}</div>
    </div>`;
  }).join('');
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
  renderSlots(); renderInv();
  if (stageObj?.app) stageObj.setLook(lookFor(S.stage, eq, S.assets), { animate: 'equip' });
  clearTimeout(saveT);
  saveT = setTimeout(() => saveHero({ equipped: eq }).catch(e => toast(e.message, 2500)), 600);
}

/** Leaving the screen stops the renderer (router calls this on hash change). */
export function leaveHero() { stageObj?.destroy(); stageObj = null; }
window.addEventListener('hashchange', () => { if (!/^#\/hero/.test(location.hash)) leaveHero(); });
