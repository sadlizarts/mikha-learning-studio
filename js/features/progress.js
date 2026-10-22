// Progress (v2.6.0 Night Dojo "Power scan"): hero + key stats, glowing score trend, escaped monsters (Needs work),
// seals by world, strong chapters, all chapters (folded). Thresholds stay in app_settings (PRD §8.1–8.2b, FR-33/34).
import { $, esc, subjectMeta, shortCode, levelInfo } from '../ui.js';
import { completedAttempts } from '../store.js';
import { catalog, chapterIndex, viewerId } from '../state.js';
import { show } from '../router.js';
import { lessonsMeta } from './learn.js';
import { dojoData } from './dojo.js';
import { heroPic } from '../hero/art.js';
import { FAMILIES, monsterSVG } from '../monsters.js';
import { loadReports, benchmarks, reportPlot, reportSummary, termName, GOAL } from '../report.js';

/** Glowing area chart of the last scores (oldest → newest) with the seal line. */
function trendChart(scores, seal) {
  if (scores.length < 2) return '<p class="nd-sub">The trend appears after 2 finished practices.</p>';
  const W = 340, H = 120, P = 8, n = scores.length;
  const lo = Math.max(0, Math.floor((Math.min(...scores, seal) - 10) / 10) * 10);   // zoom in: bottom of the chart = 10 below the lowest score
  const x = (i) => P + i * (W - 2 * P) / (n - 1), y = (s) => H - P - (s - lo) * (H - 2 * P) / (100 - lo);
  const pts = scores.map((s, i) => `${x(i).toFixed(1)} ${y(s).toFixed(1)}`);
  const line = 'M' + pts.join(' L'), area = `${line} L${x(n - 1).toFixed(1)} ${H} L${x(0).toFixed(1)} ${H}Z`;
  const last = scores[n - 1];
  return `<svg class="pg-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Scores of the last ${n} practices, latest ${last}">
    <defs><linearGradient id="pgfill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#FFD25A" stop-opacity=".42"/><stop offset="1" stop-color="#FFD25A" stop-opacity="0"/></linearGradient></defs>
    <line x1="0" x2="${W}" y1="${y(seal)}" y2="${y(seal)}" stroke="#46E0A0" stroke-dasharray="4 5" opacity=".7"/>
    <text x="${W / 2}" y="${y(seal) + 13}" text-anchor="middle" fill="#46E0A0" font-size="10" font-weight="900">SEAL ${seal}%</text>
    <path d="${area}" fill="url(#pgfill)"/>
    <text x="2" y="${H - 2}" fill="#7A7299" font-size="9" font-weight="900">${lo}</text><text x="2" y="${P + 8}" fill="#7A7299" font-size="9" font-weight="900">100</text>
    <path d="${line}" fill="none" stroke="#FFD25A" stroke-width="3" stroke-linejoin="round" stroke-linecap="round" class="pg-line"/>
    ${scores.map((s, i) => `<circle cx="${x(i).toFixed(1)}" cy="${y(s).toFixed(1)}" r="${i === n - 1 ? 5 : 2.5}" fill="${i === n - 1 ? '#fff' : '#FFD25A'}" ${i === n - 1 ? 'stroke="#FFD25A" stroke-width="3"' : ''}/>`).join('')}
  </svg>`;
}

/** v2.9 school report card: every subject vs the 90 line and the next goal (latest report = benchmark). */
function reportCard(reps) {
  const bms = benchmarks(reps); if (!bms.length) return '';
  const S = reportSummary(bms), r = reps[0], all = S.above === S.n;
  return `<div class="nd-card pg-report"><div class="row between"><div><div class="nd-label">School report · ${esc(termName(r))}</div><div class="nd-h2" style="font-size:18px">Mission: every subject ${GOAL}+</div></div>
      <div class="pg-rep-avg"><b class="num">${S.all}</b><span>average</span></div></div>
    <div class="pg-rep-chips"><span class="${all ? 'ok' : 'warn'}">${all ? '✓' : '!'} ${S.above}/${S.n} subjects at ${GOAL}+</span>${S.tight.length ? `<span class="warn">! ${S.tight.length} tight (90–92)</span>` : ''}${S.below.length ? `<span class="warn">! ${S.below.length} below ${GOAL}</span>` : ''}</div>
    ${reportPlot(bms, { lang: 'en' })}
    <p class="nd-sub" style="font-size:12px;margin:8px 0 0">Your goal for each subject: beat this report by 1 point (never below ${GOAL}). Practice in the app trains the 6 subjects at the top.</p></div>`;
}

export async function renderProgress() {
  show('progress');
  const body = $('#progress-body');
  if (!body.dataset.ready) body.innerHTML = '<div class="loading" style="height:30vh"><div class="spin"></div></div>';
  let cat, done = [], lidx = {}, d = null, reps = [];
  try {
    [cat, done, lidx, d, reps] = await Promise.all([catalog(true), completedAttempts(viewerId(), 40), lessonsMeta().catch(() => ({})), dojoData().catch(() => null), loadReports(true).catch(() => [])]);
  } catch (e) { body.innerHTML = `<div class="panel sunk empty">${esc(e.message)}</div>`; return; }
  const idx = chapterIndex(cat);
  const R = cat.rules || {};
  const MIN_ANSWERED = +R.min_answered || 15, NEEDS = +R.needs_work_threshold || 70, STRONG = +R.strong_threshold || 85, HINT = +R.hint_rate_threshold || 50;
  const SEAL = d?.R?.win || 80;
  const rows = Object.values(cat.statBy).filter(s => s.answered > 0 && idx[s.chapter_id]).map(s => ({ ...s, ch: idx[s.chapter_id] }));
  const report = reportCard(reps);
  if (!rows.length && !done.length) {
    body.innerHTML = report + '<div class="nd-card" style="text-align:center"><div class="nd-h2">No battles yet</div><p class="nd-sub" style="margin:6px 0 12px">Your first practice unlocks this page.</p><button class="nd-btn primary" data-nav="#/pick">Pick chapters →</button></div>';
    return;
  }
  const boss = Object.fromEntries((d?.bosses || []).map(b => [b.ch.chapter_id, b]));
  const thumb = (cid, size = 52) => { const b = boss[cid]; return b ? monsterSVG(b.ch, { phase: b.phase === 'new' ? 'minion' : b.phase, size, angry: b.angry }) : ''; };

  // power card
  const now = Date.now(), D = 86400000;
  const avg = (arr) => arr.length ? Math.round(arr.reduce((t, a) => t + a.score, 0) / arr.length) : null;
  const wk = avg(done.filter(a => now - new Date(a.finished_at) < 7 * D));
  const prev = avg(done.filter(a => { const t = now - new Date(a.finished_at); return t >= 7 * D && t < 14 * D; }));
  const delta = wk === null || prev === null ? '' : wk > prev ? `<i class="up">▲ ${wk - prev}</i>` : wk < prev ? `<i class="down">▼ ${prev - wk}</i>` : '<i>→</i>';
  const prog = d?.prog, lv = levelInfo(prog?.xp_total || 0), rk = d?.rk;
  const power = `<div class="nd-card pg-power" style="--belt:${rk?.color || '#F4F1EA'}">
      <div class="pg-hero">${heroPic({ stage: rk?.rank || 0 }, { w: 120, h: 170, fit: 'cover' })}<span class="belt-chip" style="--belt:${rk?.color || '#F4F1EA'}"><i></i>${esc(rk?.belt || 'White belt')}</span></div>
      <div class="pg-stats">
        <div><b class="num" style="color:var(--nd-gold)">${wk ?? '—'}${wk !== null ? '%' : ''}</b><span>7-day avg ${delta}</span></div>
        <div><b class="num">${lv.level}</b><span>Level · ${esc(lv.tier)}</span></div>
        <div><b class="num" style="color:#FF8A3D">${prog?.current_streak || 0}</b><span>Day streak</span></div>
        <div><b class="num" style="color:var(--nd-ok)">${d?.beatNow ?? 0}<small>/${d?.bosses?.length ?? 0}</small></b><span>Bosses sealed</span></div>
      </div></div>`;

  const scores = done.slice(0, 12).reverse().map(a => a.score);
  const trend = `<div class="nd-card"><div class="row between"><div class="nd-label">Score trend · last ${scores.length}</div>${scores.length >= 2 ? `<span class="nd-label num" style="color:${scores[scores.length - 1] >= SEAL ? 'var(--nd-ok)' : 'var(--nd-gold)'}">Latest ${scores[scores.length - 1]}</span>` : ''}</div>${trendChart(scores, SEAL)}</div>`;

  const rated = rows.filter(r => r.answered >= MIN_ANSWERED);
  const needs = rated.filter(r => r.accuracy_recent < NEEDS).sort((a, b) => a.accuracy_recent - b.accuracy_recent);
  const strong = rated.filter(r => r.accuracy_recent >= STRONG && r.hint_rate_recent < HINT);
  const label = (r) => { const m = subjectMeta(r.ch.subject); return `${esc(m.short)} ${esc(shortCode(r.ch.code))}`; };
  const escaped = needs.length ? `<div class="nd-card pg-escaped"><div class="row between"><div class="nd-h2" style="font-size:18px">Escaped monsters</div><span class="nd-label" style="color:#FF9A9A">Below ${NEEDS}%</span></div>
      ${needs.map(r => `<div class="pg-esc" style="--c:${FAMILIES[boss[r.chapter_id]?.fam || 'sci'].c}">
        <div class="pg-thumb">${thumb(r.chapter_id)}</div>
        <div class="grow" style="min-width:0"><b>${esc(boss[r.chapter_id]?.name || r.ch.name)}</b><div class="nd-sub" style="font-size:12px">${label(r)} · ${esc(r.ch.name)}</div>
          <div class="pg-acts">${lidx[r.chapter_id] ? `<button class="nd-btn small" data-nav="#/lesson/${r.chapter_id}">Read first</button>` : ''}<button class="nd-btn small primary" data-nav="#/pick/${r.chapter_id}">Hunt →</button></div></div>
        <span class="pg-pct num">${r.accuracy_recent}%</span></div>`).join('')}</div>` : '';

  const fams = Object.keys(FAMILIES).map(k => ({ k, f: FAMILIES[k], list: (d?.bosses || []).filter(b => b.fam === k) })).filter(x => x.list.length);
  const seals = fams.length ? `<div class="nd-card"><div class="nd-label" style="margin-bottom:10px">Seals by world</div><div class="pg-worlds">${fams.map(({ k, f, list }) => {
      const sealed = list.filter(b => b.phase === 'sealed').length;
      return `<button class="pg-world" data-nav="#/bosses/${k}" style="--c:${f.c}"><div class="row between"><b>${esc(list[0].m.short)}</b><span class="num">${sealed}/${list.length}</span></div>
        <div class="pg-tal">${list.map(b => `<i class="${b.phase === 'sealed' ? 'on' : ''}${b.angry ? ' angry' : ''}" title="${esc(shortCode(b.ch.code))}"></i>`).join('')}</div></button>`; }).join('')}</div></div>` : '';

  const all = [...rows].sort((a, b) => a.accuracy_recent - b.accuracy_recent);
  const allCard = all.length ? `<details class="nd-card pg-all"><summary><span class="nd-label">All chapters you've practised (${all.length})</span><span aria-hidden="true">⌄</span></summary><div class="stack" style="gap:12px;margin-top:12px">${all.map(r => {
      const m = subjectMeta(r.ch.subject); const hint = r.accuracy_recent >= STRONG && r.hint_rate_recent >= HINT;
      return `<div class="chapbar rb-row" style="--c:${m.color}"><div class="rb-mon">${thumb(r.chapter_id, 44)}</div><div class="grow"><div class="lbl"><span>${esc(`${m.short} ${shortCode(r.ch.code)} · ${r.ch.name}`)}</span><span class="num">${r.accuracy_recent}%</span></div><div class="bar"><i style="--p:${r.accuracy_recent}%;--c:${m.color}"></i></div>
        <div class="nd-sub num" style="font-size:12px">${r.answered < MIN_ANSWERED ? `Not enough data yet (${r.answered}/${MIN_ANSWERED})` : `${r.answered} answers`}${hint ? ` · <span style="color:var(--hint)">Correct, but leaning on hints (${r.hint_rate_recent}%)</span>` : ''}</div></div></div>`;
    }).join('')}</div></details>` : '';
  const strongCard = strong.length ? `<div class="nd-card"><div class="row between" style="margin-bottom:6px"><div class="nd-h2" style="font-size:18px">Strong</div><span class="nd-label" style="color:var(--nd-ok)">${STRONG}%+ · few hints</span></div>
      ${strong.map(r => `<div class="pg-esc strong"><div class="pg-thumb">${thumb(r.chapter_id, 44)}</div><div class="grow"><b>${label(r)}</b><div class="nd-sub" style="font-size:12px">${esc(r.ch.name)}</div></div><span class="pg-pct num" style="color:var(--nd-ok)">${r.accuracy_recent}%</span></div>`).join('')}</div>` : '';

  body.innerHTML = `<div class="nd-stack pg">${power}${report}${trend}${escaped}${seals}${strongCard}${allCard}</div>`;
  body.dataset.ready = '1';
}
