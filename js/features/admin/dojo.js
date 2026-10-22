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
      const hp = b.st.status === 'defeated' ? 0 : b.st.hp;
      return `<div class="adb-row">
        <div class="adb-mon">${bossSVG(b.ch, m.color, { state: b.st.status === 'defeated' ? 'defeated' : b.st.status === 'new' ? 'new' : 'fight', size: 44 })}</div>
        <div class="adb-main"><div class="adb-top"><b>${esc(shortCode(b.ch.code))} ${esc(b.ch.name)}</b><span class="chip" style="--c:${c}"><span class="dot"></span>${l}</span></div>
          <div class="adb-sub">${esc(b.name)} · ${esc(b.title)}</div>
          <div class="adb-hp"><div class="hp"><i style="--p:${hp}%"></i></div><span class="num">HP ${hp}%</span></div>
          <div class="adb-meta num"><span>30 terakhir: <b>${b.st.n ? b.st.acc + '%' : '—'}</b></span><span>${b.st.n || 0} jawaban</span><span>${b.beaten ? `Kartu ${TIER_LABEL[cardTier(b.beaten.best_accuracy)]} · ${b.beaten.best_accuracy}%` : 'Belum ada kartu'}</span></div></div>
      </div>`;
    }).join('');
    return `<div class="panel" style="border-left:4px solid ${m.color}">
      <div class="row between"><h3>${esc(m.short)}</h3><span class="note num">${sealed}/${list.length} tersegel</span></div>
      <details ${list.some(b => ['revived', 'cracked'].includes(b.st.status)) ? 'open' : ''} style="margin-top:6px"><summary class="note" style="cursor:pointer;font-weight:900">Boss (${list.length})</summary>
        <div class="adb-list">${rows}</div>
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
