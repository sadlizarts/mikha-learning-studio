// Progress (PRD §8.1–8.2b, FR-33/34, DESIGN §5.6): score trend, Needs work (Read first / Practice), all chapters, Strong.
import { $, esc, subjectMeta, shortCode, trendSVG } from '../ui.js';
import { completedAttempts } from '../store.js';
import { app, catalog, chapterIndex } from '../state.js';
import { show } from '../router.js';
import { lessonsMeta } from './learn.js';

export async function renderProgress() {
  show('progress');
  const body = $('#progress-body');
  body.innerHTML = '<div class="loading" style="height:30vh"><div class="spin"></div></div>';
  let cat, done = [], lidx = {};
  try {
    [cat, done, lidx] = await Promise.all([catalog(true), completedAttempts(app.user.id, 40), lessonsMeta().catch(() => ({}))]);
  } catch (e) { body.innerHTML = `<div class="panel sunk empty">${esc(e.message)}</div>`; return; }
  const idx = chapterIndex(cat);
  // thresholds live in app_settings (admin-editable); defaults match PRD §8.2/8.2b
  const R = cat.rules || {};
  const MIN_ANSWERED = +R.min_answered || 15, NEEDS = +R.needs_work_threshold || 70, STRONG = +R.strong_threshold || 85, HINT = +R.hint_rate_threshold || 50;
  const rows = Object.values(cat.statBy).filter(s => s.answered > 0 && idx[s.chapter_id]).map(s => ({ ...s, ch: idx[s.chapter_id] }));
  if (!rows.length && !done.length) {
    body.innerHTML = '<div class="panel sunk empty">No battles yet. Your first practice unlocks this page.<button class="btn primary block" style="margin-top:12px" data-nav="#/pick">Pick chapters →</button></div>';
    return;
  }

  // trend: last 12 sessions, oldest → newest; chip = 7-day average vs the 7 days before
  const scores = done.slice(0, 12).reverse().map(a => a.score);
  const now = Date.now(), D = 86400000;
  const avg = (arr) => arr.length ? Math.round(arr.reduce((t, a) => t + a.score, 0) / arr.length) : null;
  const wk = avg(done.filter(a => now - new Date(a.finished_at) < 7 * D));
  const prev = avg(done.filter(a => { const d = now - new Date(a.finished_at); return d >= 7 * D && d < 14 * D; }));
  const arrow = wk === null || prev === null ? '' : wk > prev ? '↑ ' : wk < prev ? '↓ ' : '→ ';
  const trend = `<div class="panel"><div class="row between" style="margin-bottom:8px"><div class="eyebrow">Score trend · last ${scores.length}</div>${wk !== null ? `<span class="tdelta num">${arrow}7-day avg ${wk}</span>` : ''}</div>
    <div class="trend">${trendSVG(scores, NEEDS)}</div></div>`;

  const label = (r) => { const m = subjectMeta(r.ch.subject); return `<span class="chip" style="--c:${m.color}"><span class="dot"></span><span class="txt">${esc(m.short)} ${esc(shortCode(r.ch.code))}</span></span>`; };
  const rated = rows.filter(r => r.answered >= MIN_ANSWERED);
  const needs = rated.filter(r => r.accuracy_recent < NEEDS).sort((a, b) => a.accuracy_recent - b.accuracy_recent);
  const strong = rated.filter(r => r.accuracy_recent >= STRONG && r.hint_rate_recent < HINT);
  const all = [...rows].sort((a, b) => a.accuracy_recent - b.accuracy_recent);
  const pct = (r) => `<b class="num" style="font-family:var(--display);font-size:20px;font-weight:400;color:${r.accuracy_recent < NEEDS ? 'var(--bad)' : 'var(--ok)'}">${r.accuracy_recent}%</b>`;
  const line = (r) => `<div class="listrow" style="display:flex;align-items:center;gap:10px;padding:10px 0">${label(r)}<div class="grow"><div style="font-weight:900;color:var(--ink);font-size:14px">${esc(r.ch.name)}</div><div class="note num">${r.answered} answers · last 30</div></div>${pct(r)}</div>`;
  const needRow = (r) => `<div class="nwrow">${label(r)}<div class="grow"><div style="font-weight:900;color:var(--ink);font-size:14px">${esc(r.ch.name)}</div><div class="note num">last 30 answers</div></div>${pct(r)}
    <div class="acts">${lidx[r.chapter_id] ? `<button class="btn ghost xs" data-nav="#/lesson/${r.chapter_id}">Read first ›</button>` : ''}<button class="btn ghost xs" data-nav="#/pick/${r.chapter_id}">Practice ›</button></div></div>`;
  body.innerHTML = `<div class="stack">
    ${trend}
    ${needs.length ? `<div class="panel" style="border-left:8px solid var(--bad)"><div class="eyebrow">Needs work</div>${needs.map(needRow).join('')}</div>` : ''}
    ${all.length ? `<div class="panel"><div class="eyebrow" style="margin-bottom:10px">All chapters you've practised</div><div class="stack" style="gap:12px">${all.map(r => {
      const m = subjectMeta(r.ch.subject); const hint = r.accuracy_recent >= STRONG && r.hint_rate_recent >= HINT;
      return `<div class="chapbar"><div class="lbl"><span>${esc(`${m.short} ${shortCode(r.ch.code)} · ${r.ch.name}`)}</span><span class="num">${r.accuracy_recent}%</span></div><div class="bar"><i style="--p:${r.accuracy_recent}%;--c:${m.color}"></i></div>
        <div class="note num">${r.answered < MIN_ANSWERED ? `Not enough data yet (${r.answered}/${MIN_ANSWERED})` : `${r.answered} answers`}${hint ? ` · <span style="color:var(--hint)">Correct, but leaning on hints (${r.hint_rate_recent}%)</span>` : ''}</div></div>`;
    }).join('')}</div></div>` : ''}
    ${strong.length ? `<div class="panel" style="border-left:8px solid var(--ok)"><div class="eyebrow">Strong</div>${strong.map(line).join('')}</div>` : ''}
  </div>`;
}
