// Admin → Lessons (PRD FR-57, FR-58; Lampiran E). Paste or upload a lesson .md → check → preview (the student renderer)
// → upload its pictures → Save draft / Publish. Every save keeps the previous body in lesson_versions.
import { $, $$, esc, toast, sheet, shortDay } from '../../ui.js';
import { admin } from '../../store.js';
import { app, catalog, chapterIndex } from '../../state.js';
import { parseLesson, renderSections, inline } from '../../lesson-md.js';
import { chapterOptions, chapterLabel } from './common.js';

let draft = { body: '', chapterId: '', files: new Map(), filename: '' };   // files: name → File (pictures chosen here)
let stored = new Set();     // picture names already in Storage (lessons/)
let previewUrls = {};       // name → url used by the preview

function matchChapter(cat, meta) {
  const n = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  if (meta.code) { const c = cat.chapters.find(c => n(c.code) === n(meta.code)); if (c) return c.chapter_id; }
  const cand = cat.chapters.filter(c => n(c.name) === n(meta.chapter));
  if (cand.length === 1) return cand[0].chapter_id;
  const s = cat.subjects.find(x => n(x.name) === n(meta.subject));
  return cand.find(c => c.subject_id === s?.id)?.chapter_id || '';
}

export async function renderLessons(body) {
  body.innerHTML = '<div class="spin"></div>';
  const cat = await catalog(true);
  const idx = chapterIndex(cat);
  const [rows, names] = await Promise.all([admin.lessons(), admin.lessonImageNames().catch(() => new Set())]);
  stored = names;
  body.innerHTML = `<div class="stack">
    <div class="panel"><h3>Lessons</h3>
      ${rows.length ? `<table class="tbl" style="margin-top:8px"><thead><tr><th>Chapter</th><th>Status</th><th class="r">Ver.</th><th>Updated</th><th></th></tr></thead><tbody>${rows.map(l => `<tr>
        <td>${esc(chapterLabel(idx, l.chapter_id))}</td>
        <td><span class="tag ${l.status === 'published' ? 'ok' : 'warn'}">${esc(l.status)}</span></td>
        <td class="r num">v${l.version}</td>
        <td class="num">${esc(shortDay(l.updated_at))}</td>
        <td class="r" style="white-space:nowrap"><button class="btn small" data-edit="${l.chapter_id}">Edit</button>
          <button class="btn small" data-hist="${l.id}" data-ch="${l.chapter_id}">History</button>
          <button class="btn small" data-pub="${l.id}" data-to="${l.status === 'published' ? 'draft' : 'published'}">${l.status === 'published' ? 'Unpublish' : 'Publish'}</button></td></tr>`).join('')}</tbody></table>` : '<p class="note" style="margin-top:6px">No lessons yet.</p>'}
    </div>
    <div class="panel" id="les-editor">
      <h3>Import or edit a lesson (.md)</h3>
      <p class="note" style="margin-top:4px">Format: PRD Lampiran E. Claude writes these files in <b>Content/&lt;Subject&gt;/</b>; pictures are in <b>Content/&lt;Subject&gt;/img/</b>. Nothing is saved until you press Save or Publish.</p>
      <div class="split" style="margin-top:8px">
        <div>
          <label class="lbl" for="les-file">Lesson file</label><input type="file" id="les-file" accept=".md,text/markdown,text/plain">
          <label class="lbl" for="les-ch">Chapter</label>
          <select id="les-ch"><option value="">Match from the file (code / chapter)</option>${chapterOptions(cat)}</select>
          <label class="lbl" for="les-text">Markdown</label>
          <textarea id="les-text" class="code mdedit" spellcheck="false" placeholder="---&#10;subject: Science&#10;chapter: …&#10;code: S7-U2&#10;language: en&#10;---"></textarea>
          <label class="lbl" for="les-img">Pictures for this lesson (.svg / .webp)</label><input type="file" id="les-img" accept=".svg,.webp,.png,.jpg,.jpeg,image/*" multiple>
          <div class="row" style="margin-top:12px;gap:8px"><button class="btn primary block" id="les-check">Check &amp; preview</button></div>
          <div id="les-report" style="margin-top:10px"></div>
        </div>
        <div><div class="lbl">Preview (what Mikha sees)</div><div class="lprev lesson" id="les-prev"><p class="note">Press “Check &amp; preview”.</p></div></div>
      </div>
    </div>
  </div>`;

  const ta = $('#les-text', body);
  if (draft.body) { ta.value = draft.body; $('#les-ch', body).value = draft.chapterId || ''; }
  $('#les-file', body).onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    if (f.size > 2 * 1024 * 1024) { toast('That file is larger than 2 MB — is it really a lesson?'); return; }
    ta.value = await f.text(); draft.filename = f.name; toast(`Loaded ${f.name}`); check(cat);
  };
  $('#les-img', body).onchange = (e) => {
    for (const f of e.target.files) {
      if (f.size > 2 * 1024 * 1024) { toast(`${f.name} is larger than 2 MB, skipped.`); continue; }
      if (!/^[A-Za-z0-9._-]+$/.test(f.name)) { toast(`Rename ${f.name}: letters, numbers, dot, dash only.`, 3500); continue; }
      draft.files.set(f.name, f);
    }
    if (ta.value.trim()) check(cat);
  };
  $('#les-check', body).onclick = () => check(cat);
  $$('[data-edit]', body).forEach(b => b.onclick = async () => {
    const l = await admin.lesson(b.dataset.edit); if (!l) return;
    ta.value = l.body_md; $('#les-ch', body).value = l.chapter_id; draft.filename = '';
    check(cat); $('#les-editor', body).scrollIntoView({ block: 'start' });
  });
  $$('[data-pub]', body).forEach(b => b.onclick = async () => {
    const to = b.dataset.to;
    const ok = await sheet({ title: to === 'published' ? 'Publish this lesson?' : 'Unpublish this lesson?', body: to === 'published' ? 'Mikha will see it in Learn right away.' : 'It disappears from Learn and from the Read links until you publish it again.', actions: [{ label: 'Cancel', value: false }, { label: to === 'published' ? 'Publish' : 'Unpublish', value: true, cls: to === 'published' ? 'primary' : 'danger' }] });
    if (!ok) return;
    try { await admin.setLessonStatus(b.dataset.pub, to); toast(to === 'published' ? 'Published.' : 'Unpublished.'); renderLessons(body); } catch (e) { toast(e.message, 4000); }
  });
  $$('[data-hist]', body).forEach(b => b.onclick = () => showHistory(b.dataset.hist, b.dataset.ch, body, cat));
  if (draft.body) check(cat);
}

function check(cat) {
  const body = $('#admin-body');
  const text = $('#les-text').value;
  draft.body = text;
  const rep = $('#les-report'), prev = $('#les-prev');
  if (!text.trim()) { rep.innerHTML = ''; prev.innerHTML = '<p class="note">Nothing to preview.</p>'; return; }
  const p = parseLesson(text);
  const forced = $('#les-ch').value;
  const chapterId = forced || matchChapter(cat, p.meta);
  draft.chapterId = chapterId;
  const errors = [...p.errors];
  if (!chapterId) errors.push(`No chapter matched "${p.meta.code || p.meta.chapter || '?'}" — pick one above.`);
  const idx = chapterIndex(cat);
  const ch = idx[chapterId];
  if (ch && p.meta.code && String(ch.code).toLowerCase() !== String(p.meta.code).toLowerCase()) p.warnings.push(`File says ${p.meta.code} but you picked ${ch.code}.`);
  // pictures
  const imgRows = p.images.map(n => {
    const st = draft.files.has(n) ? ['ok', 'will upload'] : stored.has(n) ? ['ok', 'already uploaded'] : ['bad', 'missing'];
    return `<tr><td>${esc(n)}</td><td><span class="tag ${st[0]}">${st[1]}</span></td></tr>`;
  }).join('');
  const missing = p.images.filter(n => !draft.files.has(n) && !stored.has(n));
  const extra = [...draft.files.keys()].filter(n => !p.images.includes(n));
  rep.innerHTML = `
    <p style="font-weight:800;color:var(--ink)">${ch ? esc(chapterLabel(idx, chapterId)) : '—'} · ${p.sections.length} sections · ${p.quick.length} quick-check · ${p.words} words · ≈ ${p.readMinutes} min</p>
    <p class="note" style="margin:4px 0">Anchors: ${p.anchors.map(a => `<code>${esc(a)}</code>`).join(' ') || '—'}</p>
    ${errors.length ? `<div class="msgs">${errors.map(e => `<div class="e">✕ ${esc(e)}</div>`).join('')}</div>` : '<p><span class="tag ok">No errors</span></p>'}
    ${p.warnings.length ? `<div class="msgs">${p.warnings.map(w => `<div class="w">• ${esc(w)}</div>`).join('')}</div>` : ''}
    ${p.images.length ? `<table class="tbl" style="margin-top:8px"><thead><tr><th>Picture</th><th>Status</th></tr></thead><tbody>${imgRows}</tbody></table>` : ''}
    ${extra.length ? `<p class="note">Not used by this lesson (won't upload): ${extra.map(esc).join(', ')}</p>` : ''}
    <div class="row" style="margin-top:12px;gap:8px">
      <button class="btn block" id="les-draft" ${errors.length ? 'disabled' : ''}>Save draft</button>
      <button class="btn primary block" id="les-pub" ${errors.length ? 'disabled' : ''}>Publish</button>
    </div>`;
  // preview with real pictures where possible
  for (const u of Object.values(previewUrls)) if (u.startsWith('blob:')) URL.revokeObjectURL(u);
  previewUrls = {};
  for (const [n, f] of draft.files) previewUrls[n] = URL.createObjectURL(f);
  prev.innerHTML = (p.greeting ? `<div class="speech" style="margin-bottom:14px">${inline(p.greeting)}</div>` : '') + renderSections(p, n => previewUrls[n] || null)
    + (p.quick.length ? `<div class="panel" style="margin-top:12px"><div class="eyebrow">Quick check · ${p.quick.length}</div>${p.quick.map((q, i) => `<p style="margin-top:8px"><b>${i + 1}. ${esc(q.stem)}</b><br>${['A', 'B', 'C', 'D'].map(k => `${k === q.answer ? '<b style="color:var(--ok)">✓ ' : ''}${k}. ${esc(q.options[k])}${k === q.answer ? '</b>' : ''}`).join('<br>')}</p>`).join('')}</div>` : '');
  // stored pictures: fetch signed URLs for the preview
  p.images.filter(n => !previewUrls[n] && stored.has(n)).forEach(async n => {
    const u = await admin.lessonImageUrl(n); if (!u) return;
    previewUrls[n] = u;
    const f = prev.querySelector(`.limg[data-img="${CSS.escape(n)}"] .ph`); if (f) f.outerHTML = `<img src="${esc(u)}" alt="">`;
  });
  if (!errors.length) {
    $('#les-draft').onclick = () => save(p, chapterId, 'draft', missing, body);
    $('#les-pub').onclick = () => save(p, chapterId, 'published', missing, body);
  }
}

async function save(p, chapterId, status, missing, body) {
  if (missing.length) {
    const go = await sheet({ title: `${missing.length} picture${missing.length > 1 ? 's' : ''} missing`, body: `${esc(missing.join(', '))} — Mikha will see an empty box there until you upload ${missing.length > 1 ? 'them' : 'it'}. Save anyway?`, actions: [{ label: 'Go back', value: false }, { label: 'Save anyway', value: true, cls: 'primary' }] });
    if (!go) return;
  }
  const b1 = $('#les-draft'), b2 = $('#les-pub'); b1.disabled = b2.disabled = true;
  const label = status === 'published' ? b2 : b1; const old = label.textContent; label.textContent = 'Saving…';
  try {
    for (const n of p.images) { const f = draft.files.get(n); if (f) await admin.uploadLessonImage(f); }
    const row = await admin.saveLesson({ chapterId, body: draft.body, parsed: p, status, userId: app.user.id });
    toast(`${status === 'published' ? 'Published' : 'Saved as draft'} · v${row.version}`, 3000);
    draft = { body: '', chapterId: '', files: new Map(), filename: '' };
    renderLessons(body);
  } catch (e) {
    toast(/stem_hash|unique|duplicate/i.test(e.message) ? 'A quick-check question has the same text as a practice question in this chapter. Change its wording.' : e.message, 5000);
    b1.disabled = b2.disabled = false; label.textContent = old;
  }
}

async function showHistory(lessonId, chapterId, body, cat) {
  let vers;
  try { vers = await admin.lessonVersions(lessonId); } catch (e) { toast(e.message); return; }
  if (!vers.length) { toast('No older versions yet.'); return; }
  const pick = await sheet({
    title: 'Older versions',
    body: 'Pick one to load it into the editor. It becomes a new version only when you press Save or Publish.',
    actions: [...vers.slice(0, 8).map(v => ({ label: `v${v.version} · ${new Date(v.created_at).toLocaleString('en-GB', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}`, value: v.id })), { label: 'Close', value: null }],
  });
  if (!pick) return;
  const v = vers.find(x => x.id === pick);
  $('#les-text').value = v.body_md; $('#les-ch').value = chapterId;
  check(cat); $('#les-editor').scrollIntoView({ block: 'start' });
  toast(`Loaded v${v.version}. Press Publish to restore it.`, 3000);
}
