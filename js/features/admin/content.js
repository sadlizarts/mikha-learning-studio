// Admin → Konten → Ringkasan (v2.7.0): question bank at a glance + one card per content tool.
import { esc, subjectMeta, fmtNum } from '../../ui.js';
import { admin } from '../../store.js';
import { catalog } from '../../state.js';
import { lessonsMeta } from '../learn.js';
import { SUB_COLOR } from './overview.js';

const TOOLS = [
  ['import', '📥', 'Impor soal', 'Tambah soal dari file JSON'],
  ['review', '🚩', 'Perlu dicek', 'Soal yang sering salah atau ditandai'],
  ['questions', '❓', 'Bank soal', 'Cari, edit, paling sering salah'],
  ['lessons', '📖', 'Materi', 'Tulis dan terbitkan materi'],
  ['subjects', '🗂️', 'Mapel & bab', 'Aktifkan / nonaktifkan bab'],
  ['viewer', '👁️', 'Lihat soal', 'Soal persis seperti yang Mikha lihat'],
];

export async function renderContent(body) {
  body.innerHTML = '<div class="spin"></div>';
  const [cat, lidx, flags, missed] = await Promise.all([catalog(), lessonsMeta(true).catch(() => ({})), admin.flagCounts().catch(() => ({})), admin.mostMissed({ minAnswered: 5, limit: 50 }).catch(() => [])]);
  const toReview = missed.filter(m => m.wrong_rate >= 70).length;
  const inactive = Object.values(flags).reduce((t, n) => t + n, 0);
  const bySub = cat.subjects.map(s => { const m = subjectMeta(s); const chs = cat.chapters.filter(c => c.subject_id === s.id);
    return { m, n: chs.reduce((t, c) => t + (c.active_questions || 0), 0), chs: chs.length, lessons: chs.filter(c => lidx[c.chapter_id]).length }; });
  const total = bySub.reduce((t, x) => t + x.n, 0), max = Math.max(1, ...bySub.map(x => x.n));
  body.innerHTML = `<div class="ad-stack">
    <div class="ad-kpis three">
      <div class="ad-kpi"><div class="v num">${fmtNum(total)}</div><div class="l">Soal aktif</div></div>
      <div class="ad-kpi"><div class="v num">${Object.keys(lidx).length}</div><div class="l">Materi terbit</div></div>
      <div class="ad-kpi"><div class="v num" style="color:${toReview ? '#ec835a' : '#fff'}">${toReview}</div><div class="l">Perlu dicek</div></div>
    </div>
    <div class="ad-card"><div class="row between"><div class="ad-ttl">Soal aktif per mapel</div><span class="ad-lab">bab · materi</span></div>
      ${bySub.map(x => `<div class="ad-sbar wide" title="${esc(x.m.short)}: ${x.n} soal, ${x.chs} bab, ${x.lessons} materi"><span>${esc(x.m.short)}</span><div class="tr"><i style="width:${Math.round(100 * x.n / max)}%;background:${SUB_COLOR[x.m.key] || '#3987e5'}"></i></div><b class="num">${fmtNum(x.n)}</b><em class="num">${x.chs} · ${x.lessons}</em></div>`).join('')}</div>
    <div class="ad-tools">${TOOLS.map(([k, ic, t, s]) => `<button class="ad-tool" data-nav="#/admin/${k}">${k === 'review' && (toReview || inactive) ? `<span class="badge">${toReview || inactive}</span>` : ''}<span class="ic">${ic}</span><b>${t}</b><span>${s}</span></button>`).join('')}</div>
    ${inactive ? `<p class="ad-note">${fmtNum(inactive)} soal nonaktif menunggu perbaikan (lihat Perlu dicek).</p>` : ''}
  </div>`;
}
