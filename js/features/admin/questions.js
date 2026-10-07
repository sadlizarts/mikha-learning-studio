// Admin → Questions (FR-53..FR-55): browse, search, most-missed, edit, deactivate, delete, re-grade.
import { $, $$, esc, toast } from '../../ui.js';
import { admin } from '../../store.js';
import { catalog, chapterIndex } from '../../state.js';
import { chapterOptions, chapterLabel, qTags, openEditor, AUDIT_ASPECTS } from './common.js';

const F = { chapterId: '', status: 'all', search: '', page: 0, mode: 'browse', aspect: 'any', result: 'all' };
const RESULTS = [['all', 'All'], ['issues', 'Warn or fail'], ['fail', 'Fail'], ['warn', 'Warn'], ['none', 'Not audited']];

export async function renderQuestions(body) {
  const cat = await catalog();
  const idx = chapterIndex(cat);
  if (!F.chapterId) F.chapterId = cat.chapters.find(c => c.active_questions > 0)?.chapter_id || '';
  body.innerHTML = `<div class="stack">
    <div class="panel">
      <div class="row" style="gap:6px;margin-bottom:6px">
        <button class="btn small ${F.mode === 'browse' ? 'primary' : ''}" data-mode="browse">Browse</button>
        <button class="btn small ${F.mode === 'missed' ? 'primary' : ''}" data-mode="missed">Most missed</button>
      </div>
      <label class="lbl" for="q-ch">Chapter</label><select id="q-ch">${chapterOptions(cat, F.chapterId, { includeAll: F.mode === 'missed' })}</select>
      ${F.mode === 'browse' ? `<div class="grid2">
        <div><label class="lbl" for="q-st">Status</label><select id="q-st">${['all', 'active', 'inactive'].map(s => `<option ${s === F.status ? 'selected' : ''}>${s}</option>`).join('')}</select></div>
        <div><label class="lbl" for="q-s">Search text</label><input type="search" id="q-s" value="${esc(F.search)}" placeholder="words in the question"></div>
        <div><label class="lbl" for="q-aa">Audit aspect</label><select id="q-aa"><option value="any" ${F.aspect === 'any' ? 'selected' : ''}>Any aspect (A1–A8)</option>${AUDIT_ASPECTS.map(([k, n]) => `<option value="${k}" ${F.aspect === k ? 'selected' : ''}>${k.toUpperCase()} · ${esc(n)}</option>`).join('')}</select></div>
        <div><label class="lbl" for="q-ar">Audit result</label><select id="q-ar">${RESULTS.map(([v, n]) => `<option value="${v}" ${F.result === v ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
      </div>` : '<p class="note" style="margin-top:6px">Questions Mikha answered at least 3 times, highest % wrong first.</p>'}
    </div>
    <div id="q-list"><div class="spin"></div></div>
  </div>`;
  $$('[data-mode]', body).forEach(b => b.onclick = () => { F.mode = b.dataset.mode; F.page = 0; if (F.mode === 'missed') F.chapterId = ''; renderQuestions(body); });
  $('#q-ch').onchange = (e) => { F.chapterId = e.target.value; F.page = 0; list(idx); };
  if ($('#q-st')) $('#q-st').onchange = (e) => { F.status = e.target.value; F.page = 0; list(idx); };
  if ($('#q-aa')) $('#q-aa').onchange = (e) => { F.aspect = e.target.value; F.page = 0; list(idx); };
  if ($('#q-ar')) $('#q-ar').onchange = (e) => { F.result = e.target.value; F.page = 0; list(idx); };
  let t; if ($('#q-s')) $('#q-s').oninput = (e) => { clearTimeout(t); t = setTimeout(() => { F.search = e.target.value.trim(); F.page = 0; list(idx); }, 350); };
  list(idx);
}

async function list(idx) {
  const el = $('#q-list'); el.innerHTML = '<div class="spin"></div>';
  try {
    let rows, count, stats;
    if (F.mode === 'missed') {
      const mm = await admin.mostMissed({ chapterId: F.chapterId || null, limit: 30 });
      rows = await admin.questionsByIds(mm.map(m => m.question_id));
      const order = Object.fromEntries(mm.map((m, i) => [m.question_id, i]));
      rows.sort((a, b) => order[a.id] - order[b.id]);
      stats = Object.fromEntries(mm.map(m => [m.question_id, m])); count = rows.length;
    } else {
      ({ rows, count } = await admin.questions({ chapterId: F.chapterId, status: F.status, search: F.search, page: F.page, size: 40, audit: { aspect: F.aspect, result: F.result } }));
      stats = await admin.questionStats(rows.map(r => r.id));
    }
    const pages = Math.max(1, Math.ceil(count / 40));
    el.innerHTML = `<p class="note" style="margin:0 0 8px">${count} question${count === 1 ? '' : 's'}${F.mode === 'browse' && pages > 1 ? ` · page ${F.page + 1}/${pages}` : ''}</p>
      <div class="stack" style="gap:8px">${rows.map(q => `<button class="qrow ${q.is_active ? '' : 'inactive'}" data-q="${q.id}">
        ${F.mode === 'missed' ? `<div class="note">${esc(chapterLabel(idx, q.chapter_id))}</div>` : ''}
        <div class="s">${esc(q.stem)}</div><div style="margin-top:6px">${qTags(q, stats[q.id])}</div></button>`).join('') || '<div class="panel sunk empty">Nothing here.</div>'}</div>
      ${F.mode === 'browse' && pages > 1 ? `<div class="row between" style="margin-top:10px"><button class="btn small" id="q-prev" ${F.page ? '' : 'disabled'}>‹ Prev</button><button class="btn small" id="q-next" ${F.page + 1 < pages ? '' : 'disabled'}>Next ›</button></div>` : ''}`;
    const byId = Object.fromEntries(rows.map(r => [r.id, r]));
    $$('[data-q]', el).forEach(b => b.onclick = async () => { if (await openEditor(byId[b.dataset.q], { idx, stats: stats[b.dataset.q] })) list(idx); });
    if ($('#q-prev')) $('#q-prev').onclick = () => { F.page--; list(idx); };
    if ($('#q-next')) $('#q-next').onclick = () => { F.page++; list(idx); };
  } catch (e) { el.innerHTML = `<div class="panel sunk empty">${esc(e.message)}</div>`; toast(e.message); }
}
