// Admin → Needs review (FR-50e): inactive questions grouped by QC flag, plus "Check this question" (§8.3).
import { $, $$, esc } from '../../ui.js';
import { admin } from '../../store.js';
import { catalog, chapterIndex } from '../../state.js';
import { chapterLabel, qTags, openEditor } from './common.js';

let current = null;

export async function renderReview(body) {
  const cat = await catalog(); const idx = chapterIndex(cat);
  body.innerHTML = '<div class="spin"></div>';
  const [flags, missed] = await Promise.all([admin.flagCounts(), admin.mostMissed({ minAnswered: 5, limit: 50 })]);
  const check = missed.filter(m => m.wrong_rate >= 70);
  const groups = Object.entries(flags).sort((a, b) => b[1] - a[1]);
  body.innerHTML = `<div class="stack">
    <div class="panel"><h3>Check this question</h3><p class="note" style="margin:4px 0 8px">Answered ≥ 5 times and ≥ 70% wrong — maybe a wrong key or a confusing question.</p>
      <div class="stack" style="gap:8px" id="rv-check">${check.length ? '' : '<p class="note">Nothing flagged yet.</p>'}</div></div>
    <div class="panel"><h3>Inactive, waiting for a fix</h3>
      <div class="row" style="flex-wrap:wrap;gap:6px;margin-top:8px">${groups.map(([f, n]) => `<button class="btn small ${f === current ? 'primary' : ''}" data-flag="${esc(f)}">${esc(f)} · ${n}</button>`).join('') || '<p class="note">No inactive questions.</p>'}</div>
      <div class="stack" style="gap:8px;margin-top:10px" id="rv-list"></div></div>
    <p class="note">The 1,003 audit questions and 3,246 tier-C questions are still files in the folder (import/_belum_masuk). Claude fixes them in batches and imports the fixed ones here.</p>
  </div>`;
  if (check.length) {
    const qs = await admin.questionsByIds(check.map(c => c.question_id));
    const st = Object.fromEntries(check.map(c => [c.question_id, c]));
    $('#rv-check').innerHTML = qs.map(q => `<button class="qrow" data-q="${q.id}"><div class="note">${esc(chapterLabel(idx, q.chapter_id))}</div><div class="s">${esc(q.stem)}</div><div style="margin-top:6px">${qTags(q, st[q.id])}</div></button>`).join('');
    $$('[data-q]', $('#rv-check')).forEach(b => b.onclick = async () => { if (await openEditor(qs.find(q => q.id === b.dataset.q), { idx, stats: st[b.dataset.q] })) renderReview(body); });
  }
  $$('[data-flag]', body).forEach(b => b.onclick = () => { current = b.dataset.flag; showFlag(body, idx); $$('[data-flag]', body).forEach(x => x.classList.toggle('primary', x === b)); });
  if (current && flags[current]) showFlag(body, idx);
}

async function showFlag(body, idx) {
  const el = $('#rv-list'); el.innerHTML = '<div class="spin"></div>';
  const qs = await admin.inactiveByFlag(current, 40);
  el.innerHTML = qs.map(q => `<button class="qrow inactive" data-q="${q.id}"><div class="note">${esc(chapterLabel(idx, q.chapter_id))}</div><div class="s">${esc(q.stem)}</div><div style="margin-top:6px">${qTags(q)}</div></button>`).join('') || '<p class="note">None.</p>';
  $$('[data-q]', el).forEach(b => b.onclick = async () => { if (await openEditor(qs.find(q => q.id === b.dataset.q), { idx })) renderReview(body); });
}
