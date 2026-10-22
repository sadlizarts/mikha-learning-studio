// Admin → Mikha → Ringkasan (v2.7.0): one phone screen that answers "how is Mikha doing?" with charts.
// Bahasa Indonesia (admin is Dad's), calm Night Dojo. Chart colours: validated categorical palette (dataviz skill, dark surface #17132C);
// status colours good/warning/critical are reserved and always paired with a label.
import { esc, subjectMeta, shortCode, fmtNum, levelInfo, jakartaDate } from '../../ui.js';
import { admin, completedAttempts, myRetreats, loadAssessments, myLessonReads } from '../../store.js';
import { app, viewerId } from '../../state.js';
import { dojoData } from '../dojo.js';
import { RANKS } from '../../dojo.js';
import { daysUntil } from '../../schedule.js';

export const SUB_COLOR = { math: '#3987e5', eng: '#d95926', sci: '#199e70', pan: '#c98500', ind: '#d55181', aga: '#9085e9' };
const ST = { good: '#0ca30c', warn: '#fab219', serious: '#ec835a', crit: '#d03b3b' };
const HARI = new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', weekday: 'short', day: 'numeric', month: 'short' });

/** Everything the dashboard (and Dad's view summary on Home) needs, for the student being watched. */
export async function overviewData() {
  const vid = viewerId();
  const [d, done, act, rt, asms, reads] = await Promise.all([dojoData(true), completedAttempts(vid, 12), admin.dailyActivity(vid, 14).catch(() => []),
    myRetreats(vid).catch(() => null), loadAssessments().catch(() => []), myLessonReads(vid).catch(() => ({}))]);
  const R = d.cat.rules || {};
  return { d, done, act, rt, asms, reads, NEEDS: +R.needs_work_threshold || 70, MIN: +R.min_answered || 15, WIN: d.R.win || 80, TARGET: d.R.target || 30 };
}

/** Up to 3 things Dad should look at, most urgent first (Bahasa Indonesia). */
export function attentionItems(o) {
  const { d, rt, asms, reads, NEEDS, MIN, WIN, act } = o;
  const out = [], today = jakartaDate();
  const rToday = (rt?.recent || []).find(r => String(r.day) === today);
  if (rToday) out.push({ lvl: 'serious', ic: '!', t: `${rToday.n} Retreat hari ini (−${fmtNum(rToday.xp)} XP)`, s: 'Keluar dari latihan sebelum selesai. Detail di History.', go: ['Riwayat', '#/history'] });
  for (const a of (asms || []).filter(a => a.date_end >= today && daysUntil(a.date_start, today) <= 7).sort((x, y) => x.date_start.localeCompare(y.date_start))) {
    const ids = a.chapter_ids || [];
    const ready = ids.filter(id => { const s = d.cat.statBy[id]; return s && s.answered >= MIN && s.accuracy_recent >= WIN; }).length;
    if (ids.length && ready === ids.length) continue;
    const n = daysUntil(a.date_start, today);
    out.push({ lvl: 'warn', ic: '⏳', t: `Asesmen ${esc(a.subject_name)} ${n <= 0 ? 'minggu ini' : n === 1 ? 'besok' : `${n} hari lagi`}`, s: ids.length ? `Siap ${ready} dari ${ids.length} bab (≥${WIN}%)` : 'Bab untuk asesmen ini belum diatur', go: [ids.length ? 'Jadwal' : 'Atur bab', '#/admin/schedule'] });
  }
  const idx = Object.fromEntries(d.bosses.map(b => [b.ch.chapter_id, b]));
  const weak = Object.values(d.cat.statBy).filter(s => s.answered >= MIN && s.accuracy_recent < NEEDS && idx[s.chapter_id]).sort((a, b) => a.accuracy_recent - b.accuracy_recent)[0];
  if (weak) { const b = idx[weak.chapter_id]; out.push({ lvl: 'crit', ic: '↓', t: `${esc(b.m.short)} ${esc(shortCode(b.ch.code))} masih ${weak.accuracy_recent}%`, s: `Di bawah ${NEEDS}% · materi ${reads[weak.chapter_id]?.first_completed_at ? 'sudah' : 'belum'} dibaca`, go: ['Buat target', '#/admin/goals'] }); }
  const todayN = (act || []).find(x => String(x.day) === today)?.answers || 0;
  if (!todayN && Number(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', hour: 'numeric', hour12: false }).format(new Date())) >= 15) out.push({ lvl: 'warn', ic: '…', t: 'Belum latihan hari ini', s: d.prog?.current_streak ? `Streak ${d.prog.current_streak} hari bisa putus` : 'Belum ada jawaban hari ini' });
  if (d.rk.ready && !d.triedToday) out.push({ lvl: 'good', ic: '🥋', t: `Ujian sabuk ${esc(d.rk.next.belt)} sudah terbuka`, s: `${d.rk.have}/${d.rk.need} boss tersegel · lulus ${d.R.pass || 85}%`, go: ['Dojo', '#/admin/dojo'] });
  return out.slice(0, 3);
}

export function attentionCard(items, { title = 'Perlu perhatian' } = {}) {
  if (!items.length) return `<div class="ad-card ad-att ok"><div class="ad-lab" style="color:${ST.good}">${title}</div><div class="ad-it"><span class="ic" style="background:${ST.good}">✓</span><div><b>Semua aman</b><span>Tidak ada yang perlu ditindaklanjuti sekarang.</span></div></div></div>`;
  return `<div class="ad-card ad-att"><div class="row between"><div class="ad-lab" style="color:${ST.serious}">${title}</div><span class="ad-lab">${items.length}</span></div>
    ${items.map(i => `<div class="ad-it"><span class="ic" style="background:${ST[i.lvl]}">${i.ic}</span><div><b>${i.t}</b><span>${i.s}</span></div>${i.go ? `<button class="go" data-nav="${i.go[1]}">${i.go[0]} ›</button>` : ''}</div>`).join('')}</div>`;
}

/* ---------- charts (hand-rolled SVG, one y-axis each, native <title> tooltips) ---------- */
function activityChart(act, target, rt) {
  const W = 340, H = 130, L = 24, B = 92, T = 8;
  const max = Math.max(60, ...act.map(a => a.answers)), y = (v) => B - (v / max) * (B - T);
  const bw = (W - L) / Math.max(1, act.length), rDays = new Map((rt?.recent || []).map(r => [String(r.day), r]));
  const today = jakartaDate();
  const ticks = [0, Math.round(max / 2), max];
  return `<svg viewBox="0 0 ${W} ${H}" class="ad-svg" role="img" aria-label="Jawaban per hari, 14 hari terakhir">
    ${ticks.map(v => `<line x1="${L}" x2="${W}" y1="${y(v)}" y2="${y(v)}" stroke="rgba(255,255,255,.06)"/><text x="0" y="${y(v) + 3}" fill="#8E86B0" font-size="9">${v}</text>`).join('')}
    <line x1="${L}" x2="${W}" y1="${y(target)}" y2="${y(target)}" stroke="#FFD25A" stroke-dasharray="4 4" opacity=".75"/>
    ${act.map((a, i) => { const x = L + i * bw + 3, h = Math.max(a.answers ? 3 : 0, B - y(a.answers)), isT = String(a.day) === today, r = rDays.get(String(a.day));
      return `<g><title>${esc(HARI.format(new Date(a.day)))}: ${a.answers} jawaban, ${a.correct} benar${r ? ` · ${r.n} Retreat (−${r.xp} XP)` : ''}</title>
        <rect x="${x}" y="${B - h}" width="${bw - 6}" height="${h}" rx="${h > 4 ? 4 : 1}" fill="#3987e5" ${isT ? 'stroke="#fff" stroke-width="1.5"' : ''}/>
        <rect x="${x - 2}" y="${T}" width="${bw - 2}" height="${B - T}" fill="transparent"/>
        ${r ? `<circle cx="${x + (bw - 6) / 2}" cy="${B + 13}" r="5" fill="${ST.crit}" stroke="#17132C" stroke-width="2"/>` : ''}
        ${i % 4 === 0 || isT ? `<text x="${x + (bw - 6) / 2}" y="${H - 2}" text-anchor="middle" fill="#8E86B0" font-size="9">${isT ? 'Hari ini' : new Date(a.day).getUTCDate()}</text>` : ''}</g>`; }).join('')}
  </svg>`;
}

function scoreChart(scores, seal) {
  if (scores.length < 2) return '<p class="ad-note">Grafik muncul setelah 2 latihan selesai.</p>';
  const W = 340, H = 110, L = 26, T = 8, B = 96, n = scores.length;
  const lo = Math.max(0, Math.floor((Math.min(...scores, seal) - 10) / 10) * 10);
  const x = (i) => L + 6 + i * (W - L - 12) / (n - 1), y = (s) => B - (s - lo) * (B - T) / (100 - lo);
  return `<svg viewBox="0 0 ${W} ${H}" class="ad-svg" role="img" aria-label="Skor ${n} latihan terakhir">
    <line x1="${L}" x2="${W}" y1="${y(100)}" y2="${y(100)}" stroke="rgba(255,255,255,.06)"/><line x1="${L}" x2="${W}" y1="${y(lo)}" y2="${y(lo)}" stroke="rgba(255,255,255,.06)"/>
    <text x="0" y="${y(100) + 3}" fill="#8E86B0" font-size="9">100</text><text x="4" y="${y(lo) + 3}" fill="#8E86B0" font-size="9">${lo}</text>
    <line x1="${L}" x2="${W}" y1="${y(seal)}" y2="${y(seal)}" stroke="${ST.good}" stroke-dasharray="4 4" opacity=".85"/><text x="${W - 2}" y="${y(seal) + 12}" text-anchor="end" fill="#3fd13f" font-size="9">Segel ${seal}</text>
    <polyline fill="none" stroke="#FFD25A" stroke-width="2" stroke-linejoin="round" points="${scores.map((s, i) => `${x(i).toFixed(1)},${y(s).toFixed(1)}`).join(' ')}"/>
    ${scores.map((s, i) => `<g><title>Latihan ${i + 1} dari ${n}: ${s}</title><circle cx="${x(i).toFixed(1)}" cy="${y(s).toFixed(1)}" r="${i === n - 1 ? 5 : 3}" fill="#FFD25A" ${i === n - 1 ? 'stroke="#fff" stroke-width="2"' : ''}/><circle cx="${x(i).toFixed(1)}" cy="${y(s).toFixed(1)}" r="12" fill="transparent"/></g>`).join('')}
    <text x="${x(n - 1)}" y="${y(scores[n - 1]) - 9}" text-anchor="middle" fill="#fff" font-size="10">${scores[n - 1]}</text>
  </svg>`;
}

export async function renderOverview(body) {
  body.innerHTML = '<div class="spin"></div>';
  if (!app.viewAs) { body.innerHTML = '<div class="ad-card ad-note">Belum ada akun murid.</div>'; return; }
  const o = await overviewData();
  const { d, done, act, rt, asms, NEEDS, MIN, WIN, TARGET } = o;
  const prog = d.prog || {}, lv = levelInfo(prog.xp_total || 0), today = jakartaDate();
  const todayN = act.find(x => String(x.day) === today)?.answers ?? (prog.answers_today || 0);
  const now = Date.now(), DAY = 86400000;
  const avg = (arr) => arr.length ? Math.round(arr.reduce((t, a) => t + a.score, 0) / arr.length) : null;
  const wk = avg(done.filter(a => now - new Date(a.finished_at) < 7 * DAY)), prev = avg(done.filter(a => { const t = now - new Date(a.finished_at); return t >= 7 * DAY && t < 14 * DAY; }));
  const kpis = `<div class="ad-kpis">
    <div class="ad-kpi"><div class="v num">${todayN}<small>/${TARGET}</small></div><div class="l">Jawaban hari ini</div><div class="d">${todayN >= TARGET ? 'Target harian tercapai ✓' : `${TARGET - todayN} lagi ke target`}</div></div>
    <div class="ad-kpi"><div class="v num">${wk ?? '—'}${wk !== null ? '<small>%</small>' : ''}</div><div class="l">Rata-rata skor 7 hari</div><div class="d ${wk !== null && prev !== null ? (wk >= prev ? 'up' : 'dn') : ''}">${wk !== null && prev !== null ? `${wk >= prev ? '▲' : '▼'} ${Math.abs(wk - prev)} vs minggu lalu` : 'Belum ada pembanding'}</div></div>
    <div class="ad-kpi"><div class="v num">${prog.current_streak || 0}<small>hari</small></div><div class="l">Streak</div><div class="d">Terbaik ${prog.best_streak || 0}${prog.freeze_ready ? ' · shield siap' : ''}</div></div>
    <div class="ad-kpi"><div class="v num">L${lv.level}</div><div class="l">Level · ${esc(d.rk.belt)}</div><div class="d num">${fmtNum(prog.xp_total || 0)} XP</div></div></div>`;
  const rtSum = (rt?.recent || []).reduce((t, r) => ({ n: t.n + r.n, xp: t.xp + r.xp }), { n: 0, xp: 0 });
  const activity = `<div class="ad-card"><div class="row between"><div class="ad-ttl">Jawaban per hari · 14 hari</div><span class="ad-lab">target ${TARGET}</span></div>${activityChart(act, TARGET, rt)}
    <div class="ad-legend"><span><i style="background:#3987e5"></i>Jawaban</span><span><i style="background:${ST.crit};border-radius:50%"></i>Hari ada Retreat${rtSum.n ? ` (${rtSum.n}×, −${fmtNum(rtSum.xp)} XP)` : ''}</span><span><i class="dash"></i>Target harian</span></div></div>`;
  const scores = done.slice().reverse().map(a => a.score);
  const scoreCard = `<div class="ad-card"><div class="row between"><div class="ad-ttl">Skor per latihan</div><span class="ad-lab">${scores.length} terakhir</span></div>${scoreChart(scores, WIN)}</div>`;

  // mastery by subject (answer-weighted last-30 accuracy)
  const subs = d.cat.subjects.map(s => {
    const m = subjectMeta(s), chs = d.bosses.filter(b => b.ch.subject_id === s.id);
    const st = chs.map(b => d.cat.statBy[b.ch.chapter_id]).filter(x => x && x.answered > 0);
    const w = st.reduce((t, x) => t + Math.min(30, x.answered), 0);
    const acc = w ? Math.round(st.reduce((t, x) => t + x.accuracy_recent * Math.min(30, x.answered), 0) / w) : null;
    return { s, m, chs, acc, sealed: chs.filter(b => b.phase === 'sealed').length };
  });
  const mastery = `<div class="ad-card"><div class="row between"><div class="ad-ttl">Penguasaan per mapel</div><span class="ad-lab">30 jawaban terakhir</span></div>
    ${subs.map(x => `<div class="ad-sbar" title="${esc(x.m.short)}: ${x.acc ?? '—'}% · ${x.sealed}/${x.chs.length} bab tersegel"><span>${esc(x.m.short)}</span><div class="tr"><i style="width:${x.acc || 0}%;background:${SUB_COLOR[x.m.key] || '#3987e5'}"></i><u style="left:${WIN}%"></u></div><b class="num">${x.acc !== null ? x.acc + '%' : '—'}</b></div>`).join('')}
    <div class="ad-legend"><span><i style="background:#fff;width:2px;opacity:.6"></i>Garis segel ${WIN}%</span></div></div>`;

  const cls = (b) => { const s = d.cat.statBy[b.ch.chapter_id]; if (!s || s.answered < MIN) return 'na'; return s.accuracy_recent >= WIN ? 'ok' : s.accuracy_recent >= NEEDS ? 'w' : 'c'; };
  const map = `<div class="ad-card"><div class="row between"><div class="ad-ttl">Peta bab</div><button class="ad-more" data-nav="#/admin/student">Detail ›</button></div>
    ${subs.filter(x => x.chs.length).map(x => `<div class="ad-heat"><div class="n">${esc(x.m.short)}</div><div class="g">${x.chs.map(b => { const s = d.cat.statBy[b.ch.chapter_id];
      return `<i class="${cls(b)}${b.angry ? ' angry' : ''}" title="${esc(shortCode(b.ch.code))} ${esc(b.ch.name)}: ${s?.answered ? `${s.accuracy_recent}% · ${s.answered} jawaban` : 'belum dilatih'}${b.angry ? ' · monster marah' : ''}">${esc(shortCode(b.ch.code))}</i>`; }).join('')}</div></div>`).join('')}
    <div class="ad-legend"><span><i style="background:${ST.crit}"></i>Di bawah ${NEEDS}%</span><span><i style="background:#8a6400"></i>${NEEDS}–${WIN - 1}%</span><span><i style="background:#0b7d0b"></i>Tersegel ${WIN}%+</span><span><i style="background:rgba(255,255,255,.14)"></i>&lt;${MIN} jawaban</span></div></div>`;

  const soon = (asms || []).filter(a => a.date_end >= today && daysUntil(a.date_start, today) <= 21).sort((x, y) => x.date_start.localeCompare(y.date_start)).slice(0, 4);
  const exams = `<div class="ad-card"><div class="row between"><div class="ad-ttl">Asesmen sekolah</div><button class="ad-more" data-nav="#/admin/schedule">Jadwal ›</button></div>
    ${soon.length ? soon.map(a => { const ids = a.chapter_ids || []; const ready = ids.filter(id => { const s = d.cat.statBy[id]; return s && s.answered >= MIN && s.accuracy_recent >= WIN; }).length;
      const pct = ids.length ? Math.round(100 * ready / ids.length) : 0, n = daysUntil(a.date_start, today), col = !ids.length ? '#5a537a' : pct >= 100 ? ST.good : pct >= 50 ? ST.warn : ST.crit;
      return `<div class="ad-exam"><div class="ring" style="--p:${pct};--rc:${col}"><b class="num">${ids.length ? pct + '%' : '?'}</b></div><div style="min-width:0;flex:1"><b>${esc(a.subject_name || (d.cat.subjects.find(s => s.id === a.subject_id)?.name) || "Asesmen")}</b><span>${ids.length ? `${ready} dari ${ids.length} bab siap (≥${WIN}%)` : 'Bab belum diatur'}</span></div><div class="ad-days"><b class="num">${Math.max(0, n)}</b><span>${n <= 0 ? 'SEKARANG' : 'HARI'}</span></div></div>`; }).join('')
      : '<p class="ad-note">Tidak ada asesmen dalam 3 minggu ke depan.</p>'}</div>`;

  const rk = d.rk;
  const game = `<div class="ad-card"><div class="row between"><div class="ad-ttl">Progres game</div><button class="ad-more" data-nav="#/admin/dojo">Dojo ›</button></div>
    ${rk.next ? `<div class="ad-gl"><span>${esc(rk.belt)} → ${esc(rk.next.belt)}</span><span class="num">${rk.have}/${rk.need} boss${rk.ready ? ' · ujian terbuka' : ''}</span></div><div class="ad-bar"><i style="width:${Math.min(100, Math.round(100 * rk.have / rk.need))}%;background:#FFD25A"></i></div>` : `<div class="ad-gl"><span>${esc(rk.belt)} · sabuk tertinggi</span></div>`}
    <div class="ad-gl"><span>Boss tersegel</span><span class="num">${d.beatNow} / ${d.bosses.length}</span></div><div class="ad-bar"><i style="width:${Math.round(100 * d.beatNow / Math.max(1, d.bosses.length))}%;background:${ST.good}"></i></div>
    <div class="ad-gl"><span>Level ${lv.level} → ${lv.level + 1}</span><span class="num">${fmtNum(lv.toNext)} XP lagi</span></div><div class="ad-bar"><i style="width:${lv.pct}%;background:#3987e5"></i></div></div>`;

  body.innerHTML = `<div class="ad-stack">${attentionCard(attentionItems(o))}${kpis}${activity}${scoreCard}${mastery}${map}${exams}${game}
    <p class="ad-note" style="text-align:center">Data ${esc(app.viewAs.name)} · ${esc(HARI.format(new Date()))} · sentuh grafik untuk detail</p></div>`;
}
