// v2.9.0 school report cards → benchmarks. The latest report score per subject is Mikha's benchmark;
// the goal for the next report is "beat it by 1, never below 90" (99–100 = hold the top). Sadli, 22 Oct 2026.
// No grade prediction: practice accuracy is shown next to the report, never turned into a forecast.
import { esc } from './ui.js';
import { reportCards } from './store.js';
import { viewerId } from './state.js';

export const GOAL = 90;
const cache = { id: null, at: 0, data: null };

export async function loadReports(force = false) {
  const id = viewerId();
  if (!id) return [];
  if (force || cache.id !== id || !cache.data || Date.now() - cache.at > 300000) {
    try { cache.data = await reportCards(id); } catch { cache.data = cache.id === id && cache.data ? cache.data : []; }
    cache.id = id; cache.at = Date.now();
  }
  return cache.data || [];
}

export function termName(r, lang = 'en') {
  const m = String(r?.term_key || '').match(/^(MID|FINAL)(\d)$/);
  if (!m) return r?.title || '';
  return lang === 'id' ? `${m[1] === 'MID' ? 'Midterm' : 'Rapor akhir'} ${m[2]}` : `${m[1] === 'MID' ? 'Midterm' : 'Final report'} ${m[2]}`;
}

export function targetFor(score) {
  const s = Math.round(+score);
  if (s >= 99) return { target: s, hold: true };
  return { target: Math.max(GOAL, Math.min(100, s + 1)), hold: false };
}

/** One row per subject printed on the newest report (report order), with the previous report's score if any. */
export function benchmarks(reports) {
  const [latest, ...older] = reports || [];
  if (!latest) return [];
  const key = (x) => x.subject_id || x.subject_label;
  return [...(latest.report_scores || [])].sort((a, b) => a.sort_order - b.sort_order).map(x => {
    const score = +x.score, prevRow = older.map(r => (r.report_scores || []).find(y => key(y) === key(x))).find(Boolean);
    return { ...x, score, prev: prevRow ? +prevRow.score : null, margin: score - GOAL, ...targetFor(score), report: latest };
  });
}

export const benchFor = (bms, subjectId) => (bms || []).find(b => b.subject_id === subjectId) || null;

/** status: ok (3+ above 90), tight (90–92), below (<90). Always shown with a word, never colour alone. */
export const statusOf = (b) => b.score < GOAL ? 'below' : b.margin <= 2 ? 'tight' : 'ok';

const LINES = {
  ok: ['You can beat it, Mikha!', 'Raise your own record!', 'One point higher. You got this!', 'Champions beat their last score.'],
  tight: ['Only {m} above 90. Guard it!', 'Close to the 90 line. Build a safe gap!', 'Make this one safe: go higher!'],
  below: ['Comeback time: back above 90!', 'This is the subject to power up!'],
  hold: ['Near perfect. Keep it at the top!', 'Defend your crown!'],
};
const dayPick = (arr, salt) => arr[(Math.floor(Date.now() / 86400000) + salt) % arr.length];

/** Banner shown when Mikha opens a subject (Learn / Pick). */
export function benchBanner(b, subjectShort) {
  if (!b) return '';
  const st = statusOf(b), line = dayPick(b.hold ? LINES.hold : LINES[st], (b.subject_label || '').length).replace('{m}', b.margin);
  const prev = b.prev !== null ? ` <span class="bb-prev">${b.score >= b.prev ? '▲' : '▼'} ${Math.abs(b.score - b.prev)} vs before</span>` : '';
  return `<div class="benchbar ${st}${b.hold ? ' hold' : ''}" role="note">
    <div class="bb-score"><b class="num">${Math.round(b.score)}</b><span>${esc(termName(b.report))}</span></div>
    <div class="bb-txt"><b>${esc(subjectShort)}: your benchmark is ${Math.round(b.score)}${prev}</b>
      <span>${b.hold ? 'Goal: stay at' : 'Goal next report:'} <em class="num">${b.target}${b.hold ? '' : '+'}</em> · ${esc(line)}</span></div></div>`;
}

/** One line for the start of a battle (several subjects → compact list). */
export function benchLine(list) {
  const xs = (list || []).filter(Boolean);
  if (!xs.length) return '';
  if (xs.length === 1) { const [b, short] = [xs[0].b, xs[0].short];
    return `🎯 <b>${esc(short)} benchmark ${Math.round(b.score)}</b> <span>${b.hold ? `Stay at ${b.target}.` : `Beat it: ${b.target}+ on the next report.`} Every right answer counts!</span>`; }
  return `🎯 <b>Benchmarks</b> <span>${xs.map(x => `${esc(x.short)} ${Math.round(x.b.score)} → ${x.b.target}${x.b.hold ? '' : '+'}`).join(' · ')}</span>`;
}

/** Dot plot of every subject on the newest report: 90 line, score dot, target ring. lang 'en' (Mikha) | 'id' (Dad). */
export function reportPlot(bms, { lang = 'en', practice = {}, comments = false } = {}) {
  if (!bms.length) return '';
  const lo = Math.min(80, Math.floor((Math.min(...bms.map(b => b.score)) - 5) / 5) * 5), pos = (v) => `${(100 * (v - lo) / (100 - lo)).toFixed(1)}%`;
  const W = lang === 'id' ? { ok: 'Aman', tight: 'Tipis', below: 'Di bawah 90', app: 'Dilatih di app', other: 'Mapel lain', goal: 'target', prac: 'latihan' }
                         : { ok: 'Safe', tight: 'Tight', below: 'Below 90', app: 'Trained in the app', other: 'Other subjects', goal: 'goal', prac: 'practice' };
  const row = (b) => { const st = statusOf(b), p = practice[b.subject_id];
    const head = `<span class="rp-n">${esc(b.subject_label)}</span>
      <span class="rp-tr"><i class="rp-90" style="left:${pos(GOAL)}"></i><i class="rp-tg" style="left:${pos(b.target)}" title="${W.goal} ${b.target}"></i><i class="rp-dot ${st}" style="left:${pos(b.score)}"></i></span>
      <b class="rp-v num">${Math.round(b.score)}</b>`;
    const sub = `<span class="rp-st ${st}">${W[st]}</span> ${b.hold ? (lang === 'id' ? 'pertahankan' : 'hold') : `${W.goal} ${b.target}+`}${b.prev !== null ? ` · ${b.score >= b.prev ? '▲' : '▼'}${Math.abs(b.score - b.prev)}` : ''}${p !== undefined ? ` · ${W.prac} ${p === null ? '—' : p + '%'}` : ''}`;
    return comments && b.comment
      ? `<details class="rp-row"><summary>${head}<span class="rp-sub">${sub} · ${lang === 'id' ? 'komentar guru ⌄' : 'comment ⌄'}</span></summary><p class="rp-cm">${esc(b.comment)}</p></details>`
      : `<div class="rp-row">${head}<span class="rp-sub">${sub}</span></div>`; };
  const app = bms.filter(b => b.subject_id), other = bms.filter(b => !b.subject_id);
  const axis = `<div class="rp-axis"><span></span><span class="rp-tr"><em style="left:0">${lo}</em><em style="left:${pos(GOAL)}">90</em><em style="left:100%">100</em></span><span></span></div>`;
  return `<div class="rp">${axis}
    ${app.length ? `<div class="rp-grp">${W.app}</div>${app.map(row).join('')}` : ''}
    ${other.length ? `<div class="rp-grp">${W.other}</div>${other.map(row).join('')}` : ''}
    <div class="rp-legend"><span><i class="rp-dot ok"></i>${lang === 'id' ? 'Nilai' : 'Score'}</span><span><i class="rp-tg"></i>${lang === 'id' ? 'Target berikutnya' : 'Next goal'}</span><span><i class="rp-90"></i>${lang === 'id' ? 'Batas 90' : 'The 90 line'}</span></div></div>`;
}

export function reportSummary(bms) {
  const avg = (xs) => xs.length ? Math.round(10 * xs.reduce((t, b) => t + b.score, 0) / xs.length) / 10 : null;
  const app = bms.filter(b => b.subject_id);
  return { all: avg(bms), app: avg(app), n: bms.length, above: bms.filter(b => b.score >= GOAL).length, tight: bms.filter(b => statusOf(b) === 'tight'), below: bms.filter(b => statusOf(b) === 'below') };
}
