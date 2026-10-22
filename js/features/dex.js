// v3.2.0 Monster Dex: one card per chapter guardian. Sealing a boss opens its card; tier from the best accuracy
// (Bronze < 90, Silver 90+, Gold 95+ with a shiny ✦). One card frame (from chests) dresses every open card. #/dex
import { $, $$, esc, shortCode, toast } from '../ui.js';
import { loadHero, saveHero, cosmetics } from '../store.js';
import { app, viewerId } from '../state.js';
import { show } from '../router.js';
import { dojoData } from './dojo.js';
import { cardTier } from '../dojo.js';
import { FAMILIES, monsterSVG } from '../monsters.js';

const TIER = { bronze: ['Bronze', '#C47A3A'], silver: ['Silver', '#B8C2D0'], gold: ['Gold', '#F5C400'] };
let famF = 'all', D = null;

export async function renderDex() {
  show('dex');
  const body = $('#dex-body');
  if (!body.dataset.ready) body.innerHTML = '<div class="loading" style="height:50vh"><div class="spin"></div></div>';
  try {
    const vid = viewerId();
    const [d, hp, cos] = await Promise.all([dojoData(), loadHero(vid).catch(() => ({ equipped: {} })), cosmetics(vid).catch(() => ({ items: [], owned: new Set(), shards: 0 }))]);
    D = { d, hp, cos, frame: hp?.equipped?.frame && cos.owned.has(hp.equipped.frame) ? hp.equipped.frame : null, viewing: !!app.viewAs };
  } catch (e) { body.innerHTML = `<div class="nd-card">${esc(e.message)}</div>`; return; }
  draw();
  body.dataset.ready = '1';
}

function draw() {
  const { d, cos, frame, viewing } = D;
  const fr = cos.items.find(i => i.key === frame);
  const frames = cos.items.filter(i => i.kind === 'frame' && cos.owned.has(i.key));
  const fams = Object.keys(FAMILIES).filter(k => d.bosses.some(b => b.fam === k));
  const list = d.bosses.filter(b => famF === 'all' || b.fam === famF);
  const got = d.bosses.filter(b => b.beaten), shiny = got.filter(b => cardTier(b.beaten.best_accuracy) === 'gold').length;
  $('#dex-body').innerHTML = `<div class="nd-stack">
    <div class="row between"><div><button class="nd-link" data-nav="#/dojo">‹ Dojo</button><div class="nd-h1">Monster Dex</div></div>
      <div class="dex-count"><b class="num">${got.length}<small>/${d.bosses.length}</small></b><span>cards · ✦${shiny}</span></div></div>
    <div class="nd-card dex-frames"><div class="row between"><div class="nd-label">Card frame</div><span class="nd-sub" style="font-size:12px">${frames.length ? 'From chests · tap to use' : 'Win frames from round chests'}</span></div>
      <div class="dex-frow"><button class="dfr ${!frame ? 'on' : ''}" data-fr="" ${viewing ? 'disabled' : ''}><span class="ci-frame" style="--c1:#5a537a;--c2:#2a2440">–</span>None</button>
      ${frames.map(f => `<button class="dfr ${frame === f.key ? 'on' : ''}" data-fr="${f.key}" ${viewing ? 'disabled' : ''}><span class="ci-frame" style="--c1:${esc(f.data?.c1)};--c2:${esc(f.data?.c2)}">✦</span>${esc(f.name)}</button>`).join('')}</div></div>
    <div class="nd-chips"><button class="nd-chip plain ${famF === 'all' ? 'on' : ''}" data-fam="all">All</button>${fams.map(k => `<button class="nd-chip ${famF === k ? 'on' : ''}" style="--c:${FAMILIES[k].c}" data-fam="${k}">${esc(FAMILIES[k].name)}</button>`).join('')}</div>
    <div class="dex-grid" style="${fr ? `--f1:${esc(fr.data?.c1)};--f2:${esc(fr.data?.c2)}` : ''}">${list.map(b => card(b, !!fr)).join('')}</div>
    <p class="nd-sub" style="font-size:12px">Seal a boss (${d.R.win}%+ on its last 30 answers) to open its card. Best accuracy sets the tier: Bronze, Silver 90%+, Gold 95%+ ✦ shiny.</p>
  </div>`;
  $$('[data-fam]').forEach(b => b.onclick = () => { famF = b.dataset.fam; draw(); });
  $$('[data-fr]').forEach(b => b.onclick = () => setFrame(b.dataset.fr || null));
}

function card(b, framed) {
  const fam = FAMILIES[b.fam];
  if (!b.beaten) return `<div class="dcard locked" style="--fc:${fam.c}"><div class="dart">${monsterSVG(b.ch, { phase: 'boss', size: 96 })}</div><b class="dcode">${esc(b.m.short)} ${esc(shortCode(b.ch.code))}</b><span class="dq">???</span></div>`;
  const t = cardTier(b.beaten.best_accuracy), [tn, tc] = TIER[t];
  return `<div class="dcard open t-${t} ${framed ? 'framed' : ''}" style="--fc:${fam.c};--tc:${tc}" title="${esc(b.ch.name)}">
    ${t === 'gold' ? '<i class="shine" aria-hidden="true"></i><span class="star">✦</span>' : ''}
    <div class="dart">${monsterSVG(b.ch, { phase: 'boss', size: 96 })}</div>
    <b class="dname">${esc(b.name)}</b><span class="dtech">${esc(b.tech)}</span>
    <span class="dmeta"><span class="dtier">${tn}</span><span class="num">${b.beaten.best_accuracy}%</span></span>
    <span class="dcode">${esc(b.m.short)} ${esc(shortCode(b.ch.code))}</span></div>`;
}

let saveT = null;
function setFrame(key) {
  if (D.viewing) return;
  D.frame = key;
  const eq = { ...(D.hp.equipped || {}) };
  if (key) eq.frame = key; else delete eq.frame;
  D.hp.equipped = eq; draw();
  clearTimeout(saveT);
  saveT = setTimeout(() => saveHero({ equipped: eq }).catch(e => toast(e.message, 2500)), 500);
}
