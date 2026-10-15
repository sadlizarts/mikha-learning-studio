// Admin → Viewer: read-only question cards, shown the way Mikha sees them (context, picture, 4 options),
// with the key marked green, the explanation and both hints. Nothing here can edit data.
import { rich, $, $$, esc, toast } from '../../ui.js';
import { admin, imageUrl } from '../../store.js';
import { catalog, chapterIndex } from '../../state.js';
import { chapterOptions, chapterLabel } from './common.js';

const V = { chapterId: '', kind: 'active', diff: 'all', pics: false, search: '', page: 0 };
const SIZE = 20;
const KINDS = [['active', 'Active bank'], ['quick', 'Quick check'], ['inactive', 'Inactive']];

export async function renderViewer(body) {
  const cat = await catalog();
  const idx = chapterIndex(cat);
  if (!V.chapterId) V.chapterId = cat.chapters.find(c => c.active_questions > 0)?.chapter_id || '';
  body.innerHTML = `<div class="stack">
    <div class="panel">
      <div class="row" style="gap:6px;margin-bottom:6px;flex-wrap:wrap">${KINDS.map(([k, n]) => `<button class="btn small ${V.kind === k ? 'primary' : ''}" data-kind="${k}">${n}</button>`).join('')}</div>
      <label class="lbl" for="v-ch">Subject · chapter</label><select id="v-ch">${chapterOptions(cat, V.chapterId)}</select>
      <div class="grid2">
        <div><label class="lbl" for="v-d">Difficulty</label><select id="v-d">${['all', 'easy', 'medium', 'hard'].map(d => `<option ${d === V.diff ? 'selected' : ''}>${d}</option>`).join('')}</select></div>
        <div><label class="lbl" for="v-s">Search text</label><input type="search" id="v-s" value="${esc(V.search)}" placeholder="words in the question"></div>
      </div>
      <label class="row" style="margin-top:10px;gap:8px;font-weight:800;color:var(--ink)"><input type="checkbox" id="v-p" ${V.pics ? 'checked' : ''}> Picture questions only</label>
      <p class="note" style="margin-top:6px">Read-only. Options are shown in A–D order; Mikha sees them shuffled. Green = answer key.</p>
    </div>
    <div id="v-list"><div class="spin"></div></div>
  </div>`;
  $$('[data-kind]', body).forEach(b => b.onclick = () => { V.kind = b.dataset.kind; V.page = 0; renderViewer(body); });
  $('#v-ch').onchange = (e) => { V.chapterId = e.target.value; V.page = 0; list(idx); };
  $('#v-d').onchange = (e) => { V.diff = e.target.value; V.page = 0; list(idx); };
  $('#v-p').onchange = (e) => { V.pics = e.target.checked; V.page = 0; list(idx); };
  let t; $('#v-s').oninput = (e) => { clearTimeout(t); t = setTimeout(() => { V.search = e.target.value.trim(); V.page = 0; list(idx); }, 350); };
  list(idx);
}

const DIFF_CLS = { easy: 'mute', medium: '', hard: 'warn' };

function card(q, n, st) {
  const hints = (q.hints || []).filter(Boolean);
  const stat = q.is_quick_check ? '<span class="tag mute">quick check · not in practice stats</span>'
    : st?.times_answered ? `<span class="tag ${st.wrong_rate >= 50 ? 'bad' : 'ok'}">Mikha: ${st.times_answered}× answered · ${st.times_answered - st.times_wrong}× right</span>`
    : '<span class="tag mute">Mikha: not answered yet</span>';
  const dist = st?.times_answered && st.choice_dist ? ` · picks ${['A', 'B', 'C', 'D'].map(k => `${k} ${st.choice_dist[k] ?? 0}`).join(' / ')}` : '';
  return `<article class="stack vq" style="gap:10px" data-id="${q.id}">
    <div class="row" style="gap:4px;flex-wrap:wrap;align-items:center"><span class="tag">#${n}</span>${q.difficulty ? `<span class="tag ${DIFF_CLS[q.difficulty] ?? ''}">${esc(q.difficulty)}</span>` : ''}${q.image_path ? '<span class="tag">picture</span>' : ''}${q.lesson_anchor ? `<span class="tag mute">${esc(q.lesson_anchor)}</span>` : ''}${q.is_active ? '' : '<span class="tag mute">inactive</span>'}${stat}</div>
    ${dist ? `<div class="note" style="margin:-4px 0 0">${esc(dist.slice(3))}</div>` : ''}
    ${q.context ? `<div class="panel sunk ctx"><div class="eyebrow">Read this first</div><div class="body">${esc(q.context)}</div></div>` : ''}
    <div class="panel qcard"><div class="stem">${rich(q.stem)}</div>${q.image_path ? `<button class="qimg" data-img="${esc(q.image_path)}" aria-label="Open picture"><div class="spin"></div></button>` : ''}</div>
    <div class="opts">${['A', 'B', 'C', 'D'].map(k => `<div class="opt ${k === q.answer_key ? 'correct' : ''}"><span class="k" aria-hidden="true">${k === q.answer_key ? '✓' : k}</span><span class="grow">${rich(q.options?.[k] ?? '')}</span>${k === q.answer_key ? '<span class="sr-only">(answer key)</span>' : ''}</div>`).join('')}</div>
    ${q.explanation ? `<div class="panel explain"><div class="eyebrow">Key ${esc(q.answer_key)} · why</div><p>${rich(q.explanation)}</p></div>` : ''}
    ${hints.map((h, i) => `<div class="hintbox" style="animation:none"><span class="tag">${hints.length === 1 ? 'Hint · Remember' : i === 0 ? 'Hint 1 · Remember' : 'Hint 2 · Next step'}</span><div>${rich(h)}</div></div>`).join('')}
  </article>`;
}

let seq = 0;
async function list(idx) {
  const my = ++seq;
  const el = $('#v-list'); el.innerHTML = '<div class="spin"></div>';
  try {
    const { rows, count } = await admin.viewerQuestions({ chapterId: V.chapterId, kind: V.kind, difficulty: V.diff, picturesOnly: V.pics, search: V.search, page: V.page, size: SIZE });
    const stats = V.kind === 'quick' ? {} : await admin.questionStats(rows.map(r => r.id));
    if (my !== seq) return;
    const pages = Math.max(1, Math.ceil(count / SIZE));
    const nav = pages > 1 ? `<div class="row between" style="margin:10px 0"><button class="btn small" data-pg="-1" ${V.page ? '' : 'disabled'}>‹ Prev</button><span class="note">page ${V.page + 1}/${pages}</span><button class="btn small" data-pg="1" ${V.page + 1 < pages ? '' : 'disabled'}>Next ›</button></div>` : '';
    el.innerHTML = `<p class="note" style="margin:0 0 8px">${esc(chapterLabel(idx, V.chapterId))} · ${count} question${count === 1 ? '' : 's'}</p>${nav}
      <div class="stack" style="gap:26px">${rows.map((q, i) => card(q, V.page * SIZE + i + 1, stats[q.id])).join('<hr style="border:0;border-top:2px dashed var(--line);margin:0">') || '<div class="panel sunk empty">Nothing here.</div>'}</div>${nav}`;
    $$('[data-pg]', el).forEach(b => b.onclick = () => { V.page += +b.dataset.pg; list(idx); $('#admin-body').scrollTop = 0; });
    $$('[data-img]', el).forEach(async b => {
      const url = await imageUrl(b.dataset.img);
      if (my !== seq) return;
      if (!url) { b.innerHTML = '<div class="note" style="padding:10px">Picture not found in storage.</div>'; return; }
      b.innerHTML = `<img src="${esc(url)}" alt="Picture for this question" loading="lazy">`;
      b.onclick = () => window.open(url, '_blank', 'noopener');
    });
  } catch (e) { if (my !== seq) return; el.innerHTML = `<div class="panel sunk empty">${esc(e.message)}</div>`; toast(e.message); }
}
