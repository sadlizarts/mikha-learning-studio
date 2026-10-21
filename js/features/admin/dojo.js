// Admin → Dojo (v1.8.1): the student's rank, today's Ki, exam history and every boss/card in one table.
import { esc, subjectMeta, shortCode, shortDay } from '../../ui.js';
import { app } from '../../state.js';
import { dojoData, rankPanel, kiPanel } from '../dojo.js';
import { bossSVG, cardTier, TIER_LABEL, RANKS } from '../../dojo.js';

const LABEL = { new: ['Not met', 'var(--ink-3)'], fight: ['Fighting', 'var(--ember)'], defeated: ['Sealed', 'var(--ok)'], cracked: ['Seal cracking', 'var(--volt-2)'], revived: ['Came back', 'var(--bad)'] };
const ORDER = { revived: 0, cracked: 1, fight: 2, defeated: 3, new: 4 };

export async function renderDojoAdmin(body) {
  body.innerHTML = '<div class="spin"></div>';
  if (!app.viewAs) { body.innerHTML = '<div class="panel sunk empty">No student account yet.</div>'; return; }
  const d = await dojoData(true);
  const { cat, bosses, prog, dj, R } = d;
  const owned = bosses.filter(b => b.beaten);
  const tiers = owned.reduce((t, b) => { t[cardTier(b.beaten.best_accuracy)]++; return t; }, { gold: 0, silver: 0, bronze: 0 });
  const shield = prog?.freeze_ready ? (prog?.freeze_needed ? 'Protecting the streak today' : 'Ready') : 'Used this week';

  const exams = (dj.exams || []).length ? `<table class="tbl"><thead><tr><th>Date</th><th>Exam for</th><th class="r">Score</th><th>Result</th></tr></thead><tbody>${dj.exams.map(e =>
    `<tr><td class="num">${esc(shortDay(e.taken_at))}</td><td>${esc(RANKS[e.rank]?.name || e.rank)}</td><td class="r num">${e.score}%</td><td>${e.passed ? '<span class="tag">Passed</span>' : '<span class="tag bad">Not yet</span>'}</td></tr>`).join('')}</tbody></table>`
    : '<p class="note">No rank exam taken yet.</p>';

  const bySub = cat.subjects.map(s => {
    const m = subjectMeta(s);
    const list = bosses.filter(b => b.ch.subject_id === s.id).sort((a, b) => ORDER[a.st.status] - ORDER[b.st.status] || a.ch.sort_order - b.ch.sort_order);
    const sealed = list.filter(b => b.st.beatNow).length;
    const rows = list.map(b => {
      const [l, c] = LABEL[b.st.status];
      return `<tr>
        <td><div class="row" style="gap:8px;align-items:center">${bossSVG(b.ch, m.color, { state: b.st.status === 'defeated' ? 'defeated' : b.st.status === 'new' ? 'new' : 'fight', size: 34 })}<div><b>${esc(shortCode(b.ch.code))}</b> ${esc(b.ch.name)}<div class="note">${esc(b.name)} · ${esc(b.title)}</div></div></div></td>
        <td><span class="chip" style="--c:${c}"><span class="dot"></span>${l}</span></td>
        <td class="r num">${b.st.status === 'defeated' ? '0' : b.st.hp}%</td>
        <td class="r num">${b.st.n ? b.st.acc + '%' : '—'}</td>
        <td class="r num">${b.st.n || 0}</td>
        <td>${b.beaten ? `${TIER_LABEL[cardTier(b.beaten.best_accuracy)]} · ${b.beaten.best_accuracy}%` : '—'}</td></tr>`;
    }).join('');
    return `<div class="panel" style="border-left:8px solid ${m.color}">
      <div class="row between"><h3>${esc(m.short)}</h3><span class="note num">${sealed}/${list.length} sealed</span></div>
      <details ${list.some(b => ['revived', 'cracked'].includes(b.st.status)) ? 'open' : ''} style="margin-top:6px"><summary class="note" style="cursor:pointer;font-weight:900">Bosses (${list.length})</summary>
        <table class="tbl" style="margin-top:6px"><thead><tr><th>Chapter · boss</th><th>Status</th><th class="r">HP</th><th class="r">Last 30</th><th class="r">Answers</th><th>Card</th></tr></thead><tbody>${rows}</tbody></table>
      </details></div>`;
  }).join('');

  body.innerHTML = `<div class="stack">
    <div class="row between" style="flex-wrap:wrap;gap:8px"><h3>${esc(app.viewAs.name)} · Dojo</h3><button class="btn small" data-nav="#/dojo">Open ${esc(app.viewAs.name.split(' ')[0])}'s Dojo screen →</button></div>
    <div class="dgrid">${rankPanel(d)}<div class="stack" style="gap:14px">${kiPanel(prog, R)}</div></div>
    <div class="kpi">
      <div><div class="v num">${d.beatNow}/${bosses.length}</div><div class="l">Bosses sealed now</div></div>
      <div><div class="v num">${owned.length}</div><div class="l">Cards · ${tiers.gold} gold · ${tiers.silver} silver · ${tiers.bronze} bronze</div></div>
      <div><div class="v num">${prog?.current_streak || 0}</div><div class="l">Streak · shield ${esc(shield)}</div></div>
      <div><div class="v num">${prog?.answers_today || 0}</div><div class="l">Answers today · XP cap ${R.cap}</div></div>
    </div>
    <div class="panel"><div class="eyebrow" style="margin-bottom:8px">Rank exams</div>${exams}</div>
    ${bySub}
    <p class="note">Sealed = at least ${R.min} answers and ${R.win}% or more on the last 30. "Came back" = it was sealed before but fell below ${R.revive}%. A card stays once earned; its tier follows the best accuracy.</p>
  </div>`;
}
