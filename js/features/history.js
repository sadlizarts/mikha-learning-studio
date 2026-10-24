// History (v2.6.0 Night Dojo "Battle log"): every finished practice and every Retreat, grouped by day; tap a battle for its result.
import { $, esc, scoreCls, fmtDur, jakartaDate, shortDay, fmtNum, clock, spanMin } from '../ui.js';
import { completedAttempts, retreatLog } from '../store.js';
import { catalog, chapterIndex, viewerId } from '../state.js';
import { show } from '../router.js';
import { chaptersLabel } from './home.js';
import { monsterSVG, phaseOf } from '../monsters.js';
import { bossState, rules } from '../dojo.js';

export async function renderHistory() {
  show('history');
  const list = $('#historylist');
  if (!list.dataset.ready) list.innerHTML = '<div class="loading" style="height:30vh"><div class="spin"></div></div>';
  try {
    const vid = viewerId();
    const [cat, rows, rts] = await Promise.all([catalog(), completedAttempts(vid, 200), retreatLog(vid, 100).catch(() => [])]);
    const idx = chapterIndex(cat), R = rules(cat);
    if (!rows.length && !rts.length) {
      list.innerHTML = '<div class="nd-card" style="text-align:center"><div class="nd-h2">No battles yet</div><p class="nd-sub" style="margin:6px 0 12px">Your first practice shows up here.</p><button class="nd-btn primary" data-nav="#/pick">Pick chapters →</button></div>';
      return;
    }
    const thumb = (cid) => { const c = idx[cid]; if (!c) return ''; const st = cat.statBy[cid]; let ph = st ? phaseOf(bossState(st, false, R), R) : 'minion'; if (ph === 'new') ph = 'minion'; return monsterSVG(c, { phase: ph, size: 46 }); };
    const best = rows.reduce((m, a) => Math.max(m, a.score || 0), 0);
    const avg = rows.length ? Math.round(rows.reduce((t, a) => t + (a.score || 0), 0) / rows.length) : 0;
    const xp = rows.reduce((t, a) => t + (a.xp_earned || 0), 0) - rts.reduce((t, r) => t + (r.xp_lost || 0), 0);
    const items = [...rows.map(a => ({ t: a.finished_at, a })), ...rts.map(r => ({ t: r.created_at, r }))].sort((x, y) => new Date(y.t) - new Date(x.t));
    const today = jakartaDate(), yday = jakartaDate(Date.now() - 86400000);
    let lastDay = '', html = '';
    for (const it of items) {
      const day = jakartaDate(it.t);
      if (day !== lastDay) { lastDay = day; html += `<div class="hs-day nd-label">${day === today ? 'Today' : day === yday ? 'Yesterday' : esc(shortDay(it.t))}</div>`; }
      if (it.a) {
        const a = it.a, first = (a.chapter_ids || [])[0];
        html += `<button class="hs-row" data-nav="#/session/${a.id}"><div class="hs-mon">${thumb(first)}</div>
          <div class="grow" style="min-width:0"><div class="t">${esc(chaptersLabel(a.chapter_ids, idx))}</div><div class="nd-sub num" style="font-size:12px">🕒 ${clock(a.started_at)}–${clock(a.finished_at)}${spanMin(a.started_at, a.finished_at) ? ` (${spanMin(a.started_at, a.finished_at)} min)` : ''} · ${a.mode && a.mode !== 'normal' ? `${{ blitz: '⚡ Blitz', rage: '💢 Rage', revenge: '🔁 Revenge' }[a.mode] || ''} · ` : ''}${a.total_questions} q${a.xp_earned ? ` · <span style="color:var(--nd-gold)">+${a.xp_earned} XP</span>` : ''}</div></div>
          <div class="score-pill num ${scoreCls(a.score)}">${a.score}</div></button>`;
      } else {
        const r = it.r;
        html += `<div class="hs-row retreat"><div class="hs-mon"><span class="hs-flag" aria-hidden="true">🏳️</span></div>
          <div class="grow" style="min-width:0"><div class="t">${r.auto ? 'Left for 24 hours' : `Retreat #${r.nth}`} · ${esc(chaptersLabel(r.chapter_ids, idx))}</div><div class="nd-sub num" style="font-size:12px">${r.attempts?.started_at ? `🕒 ${clock(r.attempts.started_at)}–${clock(r.created_at)} · ${r.attempts.answered_count}/${r.attempts.total_questions} answered · ` : `🕒 left ${clock(r.created_at)} · `}${r.rank_after < r.rank_before ? 'Belt dropped · ' : ''}monster got angry</div></div>
          <b class="hs-loss num">−${r.xp_lost}</b></div>`;
      }
    }
    list.innerHTML = `<div class="hs-sum"><div><b class="num">${rows.length}</b><span>Battles</span></div><div><b class="num">${avg}</b><span>Avg score</span></div><div><b class="num" style="color:var(--nd-ok)">${best}</b><span>Best</span></div><div><b class="num" style="color:var(--nd-gold)">${xp >= 0 ? '+' : ''}${fmtNum(xp)}</b><span>Net XP</span></div></div>${html}`;
    list.dataset.ready = '1';
  } catch (e) {
    list.innerHTML = `<div class="panel sunk empty">${esc(e.message)}</div>`;
  }
}
