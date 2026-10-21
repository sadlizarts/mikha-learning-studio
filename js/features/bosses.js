// Bosses (v2.0.0 Night Dojo): the hunt & seal collection, grouped by monster family. #/bosses[/<family>]
import { $, $$, esc } from '../ui.js';
import { show } from '../router.js';
import { dojoData, bossCard, gateCard, openBoss, bindExam } from './dojo.js';
import { FAMILIES, familyEmblem, familyPortrait } from '../monsters.js';

const ORDER = { boss: 0, elite: 1, minion: 2, new: 3, sealed: 4 };
let view = 'hunt';   // hunt | sealed | all

export async function renderBosses(famArg) {
  show('bosses');
  const body = $('#bosses-body');
  if (!body.dataset.ready) body.innerHTML = '<div class="loading" style="height:50vh"><div class="spin"></div></div>';
  let d;
  try { d = await dojoData(true); } catch (e) { body.innerHTML = `<div class="nd-card">${esc(e.message)}</div>`; return; }
  const fams = Object.keys(FAMILIES).filter(k => d.bosses.some(b => b.fam === k));
  const fam = fams.includes(famArg) ? famArg : 'all';
  const list = d.bosses.filter(b => fam === 'all' || b.fam === fam);
  const shown = list.filter(b => view === 'all' || (view === 'sealed' ? b.phase === 'sealed' : b.phase !== 'sealed'))
    .sort((a, b) => ((b.st.status === 'revived') - (a.st.status === 'revived')) || ORDER[a.phase] - ORDER[b.phase] || a.st.hp - b.st.hp);
  const f = FAMILIES[fam];
  const sealed = list.filter(b => b.phase === 'sealed').length;
  const count = (ph) => list.filter(b => b.phase === ph).length;

  body.innerHTML = `<div class="nd-stack">
    <div class="row between"><div><button class="nd-link" data-nav="#/dojo">‹ Dojo</button><div class="nd-h1">Boss hunt</div></div><span class="nd-sub nd-num">${d.beatNow}/${d.bosses.length} sealed</span></div>
    <div class="nd-chips" role="tablist">
      <button class="nd-chip plain ${fam === 'all' ? 'on' : ''}" data-nav="#/bosses">All families</button>
      ${fams.map(k => `<button class="nd-chip ${fam === k ? 'on' : ''}" style="--c:${FAMILIES[k].c}" data-nav="#/bosses/${k}">${familyEmblem(k, 30)}${esc(FAMILIES[k].name)}</button>`).join('')}
    </div>
    ${f ? `<div class="nd-card fam-banner" style="--fc:${f.c}">${familyPortrait(fam, 96)}<div style="min-width:0"><div class="nd-label">${esc(list[0].m.short)} family</div><div class="nd-h2">${esc(f.name)}</div><p class="nd-sub">${esc(f.lore)}</p>
      <p class="nd-sub" style="font-size:12px;margin-top:4px">Forms: ${f.forms.slice(0, 3).map(esc).join(' → ')} · Exam Boss: ${esc(f.forms[3])}</p></div><div style="text-align:right"><div class="nd-h1 nd-num" style="font-size:30px">${sealed}/${list.length}</div><div class="nd-label">sealed</div></div></div>` : gateCard(d)}
    <div class="row between" style="flex-wrap:wrap;gap:10px">
      <div class="nd-tabs" style="flex:1 1 300px;max-width:440px">${[['hunt', `Hunting ${list.length - sealed}`], ['sealed', `Sealed ${sealed}`], ['all', 'All']].map(([k, l]) => `<button class="${view === k ? 'on' : ''}" data-v="${k}">${l}</button>`).join('')}</div>
      <div class="row" style="gap:6px;flex-wrap:wrap">${[['boss', 'Boss'], ['elite', 'Elite'], ['minion', 'Minion']].map(([k, l]) => `<span class="nd-pill">${l} ${count(k)}</span>`).join('')}</div>
    </div>
    <div class="bgrid">${shown.length ? shown.map(bossCard).join('') : `<div class="nd-card flat nd-sub">${view === 'sealed' ? 'No seals yet in this family. Your first one will appear here.' : 'Every guardian here is sealed. Legendary!'}</div>`}</div>
    <p class="nd-sub" style="font-size:12px">Each chapter's guardian grows as you practise: Minion (under 15 answers) → Elite (accuracy under 70%) → Boss → Sealed at 80% on your last 30 answers. If accuracy drops below 70%, a sealed boss comes back.</p>
  </div>`;
  body.dataset.ready = '1';
  $$('[data-boss]', body).forEach(el => el.onclick = () => openBoss(d.bosses.find(b => b.ch.chapter_id === el.dataset.boss), d.viewing));
  $$('[data-v]', body).forEach(b => b.onclick = () => { view = b.dataset.v; renderBosses(famArg); });
  bindExam(body, d);
}
