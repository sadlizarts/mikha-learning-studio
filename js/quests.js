// v3.2.0 Daily Quests: 3 missions a day (Jakarta), always one about reading Intel. Progress is computed on the server
// from what Mikha actually did; claiming gives XP, all three = a bonus chest (Rare 80% / Epic 20%).
import { $, esc, toast } from './ui.js';
import { myQuests, claimQuest } from './store.js';
import { sfx } from './sfx.js';

export const QUEST = {
  intel2: { ic: '📜', t: 'Read 2 Intel cards', go: '#/learn' },
  intel3: { ic: '📜', t: 'Read 3 Intel cards', go: '#/learn' },
  rounds2: { ic: '⚔️', t: 'Clear 2 rounds', go: '#/pick' },
  rounds3: { ic: '⚔️', t: 'Clear 3 rounds', go: '#/pick' },
  star2: { ic: '⭐', t: 'Get ⭐⭐ in a round', go: '#/pick' },
  star3: { ic: '🌟', t: 'Perfect round ⭐⭐⭐', go: '#/pick' },
  stars5: { ic: '⭐', t: 'Collect 5 round stars', go: '#/pick' },
  combo5: { ic: '🔥', t: 'Hit a ×5 combo', go: '#/pick' },
  combo8: { ic: '🔥', t: 'Hit a ×8 combo', go: '#/pick' },
};
const RAR = { rare: ['Rare', '#3987e5'], epic: ['Epic', '#B9A6FF'], common: ['Common', '#B8C2D0'] };

export async function mountQuests(el, { readOnly = false } = {}) {
  if (!el) return;
  let q;
  try { q = await myQuests(); } catch { el.innerHTML = ''; return; }
  if (!q?.quests?.length) { el.innerHTML = ''; return; }
  const done = q.quests.filter(x => x.claimed).length;
  const chest = q.chest;
  el.innerHTML = `<div class="nd-card qs-card">
    <div class="row between"><div><div class="nd-label">Daily quests · resets 00:00</div><div class="nd-h2" style="font-size:19px">Today's missions</div></div><span class="qs-n num">${done}/3</span></div>
    ${q.quests.map(x => { const Q = QUEST[x.kind] || { ic: '•', t: x.kind, go: '#/pick' }, ready = x.progress >= x.target && !x.claimed;
      return `<div class="qs-row ${x.claimed ? 'done' : ready ? 'qready' : ''}" ${!x.claimed && !ready && !readOnly ? `data-nav="${Q.go}" role="button" tabindex="0"` : ''}>
        <span class="ic">${Q.ic}</span><div class="grow"><b>${esc(Q.t)}</b><div class="qs-bar"><i style="width:${Math.round(100 * x.progress / x.target)}%"></i></div></div>
        ${x.claimed ? `<span class="qs-ok">✓ +${x.xp}</span>` : ready && !readOnly ? `<button class="nd-btn small primary" data-claim="${x.slot}">Claim +${x.xp} XP</button>` : `<span class="qs-p num">${x.progress}/${x.target}</span>`}</div>`; }).join('')}
    <div class="qs-chest ${chest ? 'open' : done === 3 ? 'qready' : ''}">
      ${chest ? `<span>🎁</span><div><b style="color:${(RAR[chest.rarity] || RAR.rare)[1]}">${(RAR[chest.rarity] || RAR.rare)[0]}: ${esc(chest.item?.name || '')}</b><div class="nd-sub" style="font-size:12px">${chest.duplicate ? 'Duplicate → +1 shard' : 'Bonus chest opened. See Hero → Chest.'}</div></div>`
        : done === 3 && !readOnly ? '<span>🎁</span><div class="grow"><b>All 3 done!</b><div class="nd-sub" style="font-size:12px">Bonus chest: Rare 80% · Epic 20%</div></div><button class="nd-btn small primary" data-claim="0">Open</button>'
        : `<span style="opacity:.5">🎁</span><div><b>Bonus chest</b><div class="nd-sub" style="font-size:12px">Finish all 3 missions → Rare or Epic chest</div></div>`}
    </div></div>`;
  el.querySelectorAll('[data-claim]').forEach(b => b.onclick = async (e) => {
    e.stopPropagation(); b.disabled = true;
    try {
      const slot = +b.dataset.claim, r = await claimQuest(slot);
      if (slot === 0) { sfx.chest(r.rarity); toast(`🎁 ${(RAR[r.rarity] || RAR.rare)[0]}: ${r.item?.name}${r.duplicate ? ' (duplicate → +1 shard)' : '!'}`, 3200); }
      else { sfx.star(1); toast(`✓ Quest done · +${r.xp} XP`, 2000); }
      mountQuests(el, { readOnly });
    } catch (err) { toast(err.message, 2600); b.disabled = false; }
  });
}
