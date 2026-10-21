// Admin → Hero studio (v1.9.0): generate AI drafts (master, stage layers, items), review on the rig, approve.
// Only approved assets reach Mikha's screen. Generation runs in the hero-generate Edge Function (key stays server-side).
import { $, $$, esc, toast, sheet } from '../../ui.js';
import { heroAssets, heroReview, heroGenerate } from '../../store.js';
import { heroSVG, W, H } from '../../hero/art.js';
import { catalog, SLOTS } from '../../hero/items.js';
import { RANKS } from '../../dojo.js';

const CONCEPTS = [
  { key: 'storm', name: 'Storm Apprentice (matches the placeholder)', text: 'Young teen boy sorcerer-apprentice, spiky navy-blue hair with ONE red streak at the front, warm amber eyes, confident friendly grin, slim athletic build, light skin with a warm tone.' },
  { key: 'moon', name: 'Moon Scholar', text: 'Young teen boy sorcerer-apprentice, short silver-white hair swept to one side, teal eyes, calm smile, slim build, light skin.' },
  { key: 'ember', name: 'Ember Ronin', text: 'Young teen boy sorcerer-apprentice, messy auburn hair tied back in a short tail, green eyes, cheerful determined look, sturdy build, tan skin.' },
];
let concept = 'storm', busy = false;
const tpl = () => new URL('hero/pose-template.png', location.href.split('#')[0]).href;

export async function renderHeroStudio(body) {
  body.innerHTML = '<div class="spin"></div>';
  let assets = [];
  try { assets = await heroAssets({ all: true }); } catch (e) { body.innerHTML = `<div class="panel sunk empty">${esc(e.message)}</div>`; return; }
  const master = assets.find(a => a.kind === 'master' && a.status === 'approved');
  const drafts = assets.filter(a => a.status === 'draft');
  const approved = assets.filter(a => a.status === 'approved');
  const items = catalog().filter(i => i.slot !== 'aura');

  body.innerHTML = `<div class="stack">
    <div class="panel sunk note" style="font-size:14px">
      <b style="color:var(--ink)">How it works.</b> 1) Generate a few master references and approve ONE (this locks the face and body). 2) Generate stage outfits and items; each uses the master + the pose template as input images. 3) Check each draft on the rig, nudge it if needed, then approve. Mikha only ever sees approved layers; anything not approved uses the built-in placeholder art.
      <br>Needs the <code>OPENAI_API_KEY</code> secret in Supabase → Edge Functions → Secrets (you add it; it never goes into the app). Limit: 30 images per 24 h.
    </div>
    <div class="panel">
      <div class="eyebrow" style="margin-bottom:8px">1 · Master reference ${master ? '<span class="tag">Locked</span>' : '<span class="tag bad">Not chosen yet</span>'}</div>
      ${master ? `<div class="row" style="gap:12px;align-items:center"><img src="${esc(master.url)}" alt="Approved master" class="hs-thumb"><p class="note">This master is locked. Approving another one changes the hero's identity for every stage and item: only do it before Mikha has seen the hero.</p></div>` : ''}
      <div class="stack" style="gap:8px;margin-top:10px">
        ${CONCEPTS.map(c => `<label class="hs-radio"><input type="radio" name="concept" value="${c.key}" ${c.key === concept ? 'checked' : ''}><span><b>${esc(c.name)}</b><br><span class="note">${esc(c.text)}</span></span></label>`).join('')}
        <textarea id="hs-master-extra" rows="2" placeholder="Optional extra details (e.g. a small scar on the left eyebrow)"></textarea>
        <div class="row" style="gap:8px;flex-wrap:wrap">${qualitySel('hs-mq')}<button class="btn primary" id="hs-gen-master">Generate master draft</button></div>
      </div>
    </div>
    <div class="panel">
      <div class="eyebrow" style="margin-bottom:8px">2 · Stage & item layers</div>
      ${master ? '' : '<p class="note">Approve a master first; layers are drawn on top of it.</p>'}
      <div class="row" style="gap:8px;flex-wrap:wrap;align-items:center">
        <select id="hs-kind"><option value="stage">Evolution stage outfit</option><option value="back">Evolution stage cape/back</option><option value="item">Item</option></select>
        <select id="hs-stage">${RANKS.map((r, i) => `<option value="${i}">Stage ${i + 1} · ${esc(r.name)} (${esc(r.belt)})</option>`).join('')}</select>
        <select id="hs-item" hidden>${items.map(i => `<option value="${i.key}" data-slot="${i.slot}">${esc(i.name)} · ${esc(SLOTS.find(s => s.key === i.slot).name)}</option>`).join('')}</select>
        ${qualitySel('hs-lq')}
      </div>
      <textarea id="hs-layer-extra" rows="2" style="margin-top:8px;width:100%" placeholder="Describe the look (e.g. green belt, light shoulder guard, forearm wraps)"></textarea>
      <button class="btn primary" id="hs-gen-layer" style="margin-top:8px" ${master ? '' : 'disabled'}>Generate layer draft</button>
    </div>
    <div>
      <h3 style="margin-bottom:8px">3 · Review drafts <span class="note num">(${drafts.length})</span></h3>
      <div class="hs-grid">${drafts.length ? drafts.map(a => reviewCard(a, master)).join('') : '<div class="panel sunk empty">No drafts waiting.</div>'}</div>
    </div>
    <div>
      <h3 style="margin-bottom:8px">Approved <span class="note num">(${approved.length})</span></h3>
      <div class="hs-grid">${approved.length ? approved.map(a => reviewCard(a, master, true)).join('') : '<div class="panel sunk empty">Nothing approved yet: Mikha sees the placeholder hero.</div>'}</div>
    </div>
  </div>`;

  $$('[name=concept]', body).forEach(r => r.onchange = () => { concept = r.value; });
  $('#hs-kind').onchange = () => { const it = $('#hs-kind').value === 'item'; $('#hs-item').hidden = !it; $('#hs-stage').hidden = it; };
  $('#hs-gen-master').onclick = (e) => generate(e.currentTarget, body, {
    kind: 'master', slot: 'body', quality: $('#hs-mq').value,
    prompt: `${CONCEPTS.find(c => c.key === concept).text} ${$('#hs-master-extra').value}`.trim(), template_url: tpl() });
  $('#hs-gen-layer').onclick = (e) => {
    const k = $('#hs-kind').value;
    const req = k === 'item'
      ? { kind: 'item', item_key: $('#hs-item').value, slot: $('#hs-item').selectedOptions[0].dataset.slot }
      : { kind: 'stage', stage: +$('#hs-stage').value, slot: k === 'back' ? 'back' : 'outfit' };
    if (req.kind === 'stage') req.prompt = `Belt colour: ${RANKS[req.stage].belt}. ${$('#hs-layer-extra').value}`;
    else req.prompt = `${$('#hs-item').selectedOptions[0].textContent}. ${$('#hs-layer-extra').value}`;
    generate(e.currentTarget, body, { ...req, quality: $('#hs-lq').value, template_url: tpl() });
  };
  bindReview(body);
}

const qualitySel = (id) => `<select id="${id}" title="Quality (cost)"><option value="medium">Medium (cheap, drafts)</option><option value="high" selected>High</option><option value="max">Max (most expensive)</option></select>`;

function reviewCard(a, master, done = false) {
  const an = a.anchor || { x: 0, y: 0, scale: 1 };
  const label = a.kind === 'master' ? 'Master' : a.kind === 'stage' ? `Stage ${a.stage + 1} · ${a.slot}` : `${a.item_key} · ${a.slot}`;
  const base = a.kind === 'master' ? '' : master?.url ? `<img class="hs-base" src="${esc(master.url)}" alt="">` : `<div class="hs-base">${heroSVG({ stage: a.stage ?? 0 }, { w: '100%', h: '100%' })}</div>`;
  return `<div class="panel hs-card" data-id="${a.id}">
    <div class="hs-rig">${base}<img class="hs-layer" src="${esc(a.url || '')}" alt="${esc(label)} draft" style="${layerStyle(an)}"></div>
    <b>${esc(label)}</b><div class="note">${esc(new Date(a.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))} · ${esc(a.model || '')}</div>
    ${a.kind === 'master' ? '' : `<div class="row hs-nudge" style="gap:6px;margin-top:6px"><label>x <input type="number" step="4" data-k="x" value="${an.x || 0}"></label><label>y <input type="number" step="4" data-k="y" value="${an.y || 0}"></label><label>scale <input type="number" step="0.01" data-k="scale" value="${an.scale || 1}"></label></div>`}
    <div class="row" style="gap:6px;margin-top:8px">${done ? '<button class="btn small" data-act="draft">Move back to drafts</button>' : '<button class="btn small" data-act="rejected">Reject</button><button class="btn small primary" data-act="approved">Approve</button>'}</div>
  </div>`;
}
const layerStyle = (an) => `transform:translate(${(an.x || 0) / W * 100}%, ${(an.y || 0) / H * 100}%) scale(${an.scale || 1})`;

function bindReview(body) {
  $$('.hs-card', body).forEach(card => {
    const read = () => Object.fromEntries($$('[data-k]', card).map(i => [i.dataset.k, +i.value || (i.dataset.k === 'scale' ? 1 : 0)]));
    $$('[data-k]', card).forEach(i => i.oninput = () => { $('.hs-layer', card).style.cssText = layerStyle(read()); });
    $$('[data-act]', card).forEach(b => b.onclick = async () => {
      const act = b.dataset.act;
      if (act === 'approved' && card.querySelector('.hs-base') === null) {
        const ok = await sheet({ title: 'Lock this master?', body: 'This face and body become the hero\'s identity for every stage and item.', actions: [{ label: 'Cancel', value: false }, { label: 'Approve master', value: true, cls: 'primary' }] });
        if (!ok) return;
      }
      b.disabled = true;
      try { await heroReview(card.dataset.id, act, $$('[data-k]', card).length ? read() : null); toast(act === 'approved' ? 'Approved: Mikha will see it.' : act === 'rejected' ? 'Rejected.' : 'Moved back to drafts.'); renderHeroStudio(body); }
      catch (e) { toast(e.message, 3500); b.disabled = false; }
    });
  });
}

async function generate(btn, body, req) {
  if (busy) return;
  busy = true; const label = btn.textContent; btn.disabled = true; btn.textContent = 'Generating… (up to a minute)';
  try { await heroGenerate(req); toast('Draft ready. Review it below.', 3000); renderHeroStudio(body); }
  catch (e) { toast(e.message, 6000); btn.disabled = false; btn.textContent = label; }
  finally { busy = false; }
}
