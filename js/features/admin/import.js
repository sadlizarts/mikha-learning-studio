// Admin → Import (PRD FR-50, FR-51, FR-52; Lampiran A.1/A.3; QC_SOAL S-13/S-15/S-16 as warnings).
import { $, $$, esc, sheet, toast } from '../../ui.js';
import { admin, stemHash, norm } from '../../store.js';
import { app, catalog, chapterIndex } from '../../state.js';
import { chapterOptions, chapterLabel } from './common.js';

let staged = [];      // [{q, errors[], warnings[], include, hash, chapterId}]
let meta = { filename: '', note: '' };

/* ---------- parsing ---------- */
function extractBatches(text) {
  let data;
  try { data = JSON.parse(text); }
  catch (e) {
    const m = text.match(/===MLS-JSON-BEGIN===([\s\S]*?)===MLS-JSON-END===/);
    if (!m) throw new Error('This is not valid JSON: ' + e.message);
    data = JSON.parse(m[1]);
  }
  if (Array.isArray(data) && data.length && data[0].stem) return [{ questions: data }];
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.questions)) return [data];
  throw new Error('Expected {"subject","chapter","questions":[…]} (PRD Lampiran A.1).');
}

const EXT_REFS = /\b(the (passage|text|extract|article|story|poem|table|graph|diagram|chart|data) (above|below|shown|given)|(above|earlier|previous) (passage|text|table|question)|in question \d+|according to the (passage|text|article)|the source|from (its|the) context|(bacaan|teks|wacana|tabel|kutipan|ayat|hadis) (di atas|tersebut|itu|berikut)|kedua ayat|soal sebelumnya|(pertanyaan|soal) (itu|tersebut))\b/i;
const JUDGE = /(penilaian yang tepat|perbaikan(nya| yang tepat)|bagian mana yang keliru|menggantikannya|koreksi yang tepat|how should .{0,40}be corrected|what is wrong with|is (this|the) (statement|note|answer) correct)/i;
const ANCHOR = /(sebagai jawaban atas|menjawab pertanyaan|tentang |mengenai |answer(ed|s)? to|about |for the question)/i;
const BANNED = /\b(all of the above|none of the above|both a and b|semua benar|semua salah|a dan b|b dan c|tidak ada yang benar)\b/i;

function normalizeQ(raw, i) {
  const opts = raw.options || {};
  const options = Array.isArray(opts) ? { A: opts[0], B: opts[1], C: opts[2], D: opts[3] } : { A: opts.A, B: opts.B, C: opts.C, D: opts.D };
  const hints = Array.isArray(raw.hints) ? raw.hints.filter(h => typeof h === 'string' && h.trim()) : raw.hint ? [raw.hint] : [];
  return {
    n: i + 1,
    stem: String(raw.stem ?? '').trim(),
    options: Object.fromEntries(Object.entries(options).map(([k, v]) => [k, String(v ?? '').trim()])),
    answer: String(raw.answer ?? raw.answer_key ?? '').trim().toUpperCase(),
    explanation: String(raw.explanation ?? '').trim(),
    hints: hints.map(h => h.trim()),
    difficulty: ['easy', 'medium', 'hard'].includes(raw.difficulty) ? raw.difficulty : 'medium',
    context: raw.context ? String(raw.context).trim() : null,
    context_id: raw.context_id ? String(raw.context_id).trim() : null,
    lesson_anchor: raw.lesson_anchor || null,
    lock_options: !!raw.lock_options,
    image_brief: raw.image_brief || null,
    image: raw.image || null,
  };
}

function validate(q) {
  const E = [], W = [];
  if (!q.stem) E.push('stem is empty');
  if (q.stem.length > 1500) E.push(`stem ${q.stem.length} chars (max 1500)`);
  else if (q.stem.length > 1000) W.push(`long stem (${q.stem.length} chars)`);
  const vals = ['A', 'B', 'C', 'D'].map(k => q.options[k] || '');
  if (vals.some(v => !v)) E.push('needs exactly 4 options A–D');
  else if (new Set(vals.map(v => v.toLowerCase())).size < 4) E.push('two options are identical');
  if (!['A', 'B', 'C', 'D'].includes(q.answer)) E.push('answer must be A, B, C or D');
  if (!q.explanation) E.push('explanation is missing');
  if (q.hints.length > 2) E.push('more than 2 hints');
  if (q.context && (q.context.length < 40 || q.context.length > 1200)) E.push(`context ${q.context.length} chars (40–1200)`);
  if (q.context && !q.context_id) W.push('context without context_id (one will be generated)');
  // QC warnings
  if (!q.context && EXT_REFS.test(q.stem + ' ' + vals.join(' '))) W.push('S-13 refers to a text/table that is not included');
  if (JUDGE.test(q.stem) && !ANCHOR.test(q.stem) && !q.context) W.push('S-16 judged statement may not say what it is about');
  if (vals.some(v => BANNED.test(v)) && !q.lock_options) W.push('S-04 "all/none of the above" style option');
  const lens = vals.map(v => v.length), ci = 'ABCD'.indexOf(q.answer);
  if (ci >= 0 && lens[ci] === Math.max(...lens) && lens.filter(l => l === lens[ci]).length === 1 && lens[ci] > 1.5 * [...lens].sort((a, b) => b - a)[1]) W.push('S-05 correct answer is clearly the longest');
  if (q.hints.some(h => ci >= 0 && norm(h).includes(norm(vals[ci])) && norm(vals[ci]).length > 3)) W.push('S-06 a hint contains the answer');
  if (q.image_brief || q.image) W.push('needs a picture → imported as inactive');
  if (!q.hints.length) W.push('no hint');
  return { E, W };
}

function matchChapter(cat, subjectName, chapterName) {
  if (!chapterName) return null;
  const n = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const cand = cat.chapters.filter(c => n(c.name) === n(chapterName) || n(c.code) === n(chapterName) || n(c.code).endsWith(n(chapterName)));
  if (cand.length === 1) return cand[0].chapter_id;
  if (cand.length > 1 && subjectName) {
    const s = cat.subjects.find(x => n(x.name) === n(subjectName));
    const c = cand.find(c => c.subject_id === s?.id); if (c) return c.chapter_id;
  }
  return null;
}

/* ---------- rendering ---------- */
export async function renderImport(body) {
  const cat = await catalog(true);
  body.innerHTML = `<div class="stack">
    <div class="panel">
      <h3>Import questions (JSON)</h3>
      <p class="note" style="margin-top:4px">Paste the JSON from ChatGPT (format in PRD Lampiran A.1) or choose a .json file. Nothing is saved until you press Import.</p>
      <label class="lbl" for="imp-file">File</label><input type="file" id="imp-file" accept=".json,application/json,text/plain">
      <label class="lbl" for="imp-text">…or paste</label><textarea id="imp-text" class="code" placeholder='{"subject":"Science","chapter":"Materials and their structure","questions":[…]}'></textarea>
      <label class="lbl" for="imp-ch">Chapter</label>
      <select id="imp-ch"><option value="">Match from the JSON's "chapter" field</option>${chapterOptions(cat)}</select>
      <label class="lbl" for="imp-note">Note (optional)</label><input type="text" id="imp-note" placeholder="e.g. ChatGPT batch 2 · Science U6">
      <div class="row" style="margin-top:12px"><button class="btn primary block" id="imp-check">Check questions</button></div>
    </div>
    <div id="imp-stage"></div>
    <div class="panel"><h3>Recent imports</h3><div id="imp-batches" style="margin-top:8px"><div class="spin"></div></div></div>
  </div>`;
  $('#imp-file').onchange = async (e) => {
    const f = e.target.files[0]; if (!f) return;
    if (f.size > 20 * 1024 * 1024) { toast('File is larger than 20 MB.'); return; }
    meta.filename = f.name; $('#imp-text').value = await f.text(); toast(`Loaded ${f.name}`);
  };
  $('#imp-check').onclick = () => check(cat);
  renderBatches(cat);
}

async function check(cat) {
  const text = $('#imp-text').value.trim();
  if (!text) { toast('Paste JSON or choose a file first.'); return; }
  let batches;
  try { batches = extractBatches(text); } catch (e) { $('#imp-stage').innerHTML = `<div class="panel" style="border-color:var(--bad)"><b style="color:var(--bad)">${esc(e.message)}</b></div>`; return; }
  const forced = $('#imp-ch').value || null;
  staged = [];
  const hashesByChapter = {};
  const seen = new Set();
  let anchorsBy = {};
  try { anchorsBy = await admin.lessonAnchors(); } catch { /* FR-59 check skipped */ }
  for (const b of batches) {
    const chapterId = forced || matchChapter(cat, b.subject, b.chapter);
    for (const raw of (b.questions || [])) {
      const q = normalizeQ(raw, staged.length);
      const { E, W } = validate(q);
      if (!chapterId) E.push(`no chapter matched "${b.chapter || '?'}" — pick one above`);
      const hash = q.stem ? await stemHash(q.stem) : '';
      if (chapterId && !hashesByChapter[chapterId]) {
        try { hashesByChapter[chapterId] = await admin.chapterHashes(chapterId); } catch (ex) { toast(ex.message); return; }
      }
      if (chapterId && hashesByChapter[chapterId].has(hash)) E.push('duplicate: already in this chapter');
      if (seen.has(chapterId + hash)) E.push('duplicate inside this file');
      if (q.lesson_anchor && chapterId && !(anchorsBy[chapterId] || []).includes(q.lesson_anchor))
        W.push(anchorsBy[chapterId] ? `lesson_anchor "${q.lesson_anchor}" is not in this chapter's lesson (no Read link)` : `lesson_anchor "${q.lesson_anchor}" set, but this chapter has no lesson yet`);
      seen.add(chapterId + hash);
      staged.push({ q, errors: E, warnings: W, include: !E.length, hash, chapterId });
    }
  }
  meta.note = $('#imp-note').value.trim();
  renderStage(cat);
}

function renderStage(cat) {
  const idx = chapterIndex(cat);
  const ok = staged.filter(s => !s.errors.length && !s.warnings.length).length;
  const warn = staged.filter(s => !s.errors.length && s.warnings.length).length;
  const bad = staged.filter(s => s.errors.length).length;
  const chosen = staged.filter(s => s.include && !s.errors.length).length;
  $('#imp-stage').innerHTML = `<div class="panel">
    <div class="row between"><h3>${staged.length} questions checked</h3></div>
    <p style="margin:6px 0 10px;font-weight:800;color:var(--ink)"><span class="tag ok">${ok} OK</span> <span class="tag warn">${warn} with warnings</span> <span class="tag bad">${bad} errors (skipped)</span></p>
    <div class="stack" style="gap:8px;max-height:60vh;overflow:auto">${staged.map((s, i) => {
      const q = s.q; const cls = s.errors.length ? 'err' : s.warnings.length ? 'warn' : '';
      return `<div class="stage ${cls}"><div class="row" style="align-items:flex-start">
        <input type="checkbox" data-inc="${i}" ${s.include && !s.errors.length ? 'checked' : ''} ${s.errors.length ? 'disabled' : ''} aria-label="Include question ${q.n}">
        <div class="grow"><details><summary>#${q.n} ${esc(q.stem.slice(0, 110))}${q.stem.length > 110 ? '…' : ''}</summary>
          ${q.context ? `<div class="note" style="margin-top:6px;white-space:pre-line">Context: ${esc(q.context)}</div>` : ''}
          <div style="white-space:pre-line;font-weight:700;color:var(--ink);margin-top:6px">${esc(q.stem)}</div>
          <ol type="A" class="opts-mini">${['A', 'B', 'C', 'D'].map(k => `<li class="${k === q.answer ? 'key' : ''}">${esc(q.options[k] || '—')}</li>`).join('')}</ol>
          <div class="note" style="margin-top:6px">Why: ${esc(q.explanation)}</div>
          ${q.hints.map((h, j) => `<div class="note" style="color:var(--hint)">Hint ${j + 1}: ${esc(h)}</div>`).join('')}
        </details>
        <div class="note">${esc(s.chapterId ? chapterLabel(idx, s.chapterId) : 'No chapter')} · ${esc(q.difficulty)}</div>
        <div class="msgs">${s.errors.map(e => `<div class="e">✕ ${esc(e)}</div>`).join('')}${s.warnings.map(w => `<div class="w">• ${esc(w)}</div>`).join('')}</div>
        </div></div></div>`;
    }).join('')}</div>
    <button class="btn primary block" id="imp-go" style="margin-top:12px" ${chosen ? '' : 'disabled'}>Import ${chosen} question${chosen === 1 ? '' : 's'}</button>
    <p class="note" style="margin-top:6px">Warnings don't block import; they are saved as QC flags so you can find them later in Questions. Questions that need a picture are imported as inactive.</p>
  </div>`;
  $$('[data-inc]').forEach(cb => cb.onchange = () => { staged[+cb.dataset.inc].include = cb.checked; renderStage(cat); });
  $('#imp-go').onclick = () => doImport(cat);
}

async function doImport(cat) {
  const rows = staged.filter(s => s.include && !s.errors.length);
  if (!rows.length) return;
  const ok = await sheet({ title: `Import ${rows.length} questions?`, body: 'They go live for Mikha right away (except ones that need a picture). You can roll back this import later.', actions: [{ label: 'Import', value: true, cls: 'primary' }, { label: 'Cancel', value: false }] });
  if (!ok) return;
  const btn = $('#imp-go'); btn.disabled = true; btn.textContent = 'Importing…';
  try {
    const lang = (cid) => cat.subjects.find(s => s.id === cat.chapters.find(c => c.chapter_id === cid)?.subject_id)?.language || 'en';
    const batchId = await admin.createBatch({ note: meta.note || null, filename: meta.filename || null, count: rows.length, userId: app.user.id });
    const records = await Promise.all(rows.map(async s => {
      const q = s.q;
      const ctxId = q.context ? (q.context_id || 'ctx-' + (await stemHash(q.context)).slice(0, 10)) : null;
      const needsImg = !!(q.image_brief || q.image);
      const flags = s.warnings.map(w => (w.match(/^S-\d+/) || [null])[0]).filter(Boolean);
      if (needsImg) flags.push('needs image');
      return {
        chapter_id: s.chapterId, stem: q.stem, options: q.options, answer_key: q.answer, explanation: q.explanation,
        hints: q.hints, context: q.context, context_id: ctxId, lesson_anchor: q.lesson_anchor, difficulty: q.difficulty,
        language: lang(s.chapterId), lock_options: q.lock_options, stem_hash: s.hash, is_active: !needsImg,
        import_batch_id: batchId, source: 'mls', qc_flags: [...new Set(flags)],
      };
    }));
    const n = await admin.insertQuestions(records);
    toast(`Imported ${n} questions.`, 3000);
    staged = []; $('#imp-stage').innerHTML = ''; $('#imp-text').value = ''; meta = { filename: '', note: '' };
    renderBatches(await catalog(true));
  } catch (e) {
    toast(/duplicate|unique/i.test(e.message) ? 'Some questions already exist in that chapter. Check again, then import.' : e.message, 5000);
    btn.disabled = false; btn.textContent = 'Import';
  }
}

async function renderBatches() {
  const el = $('#imp-batches'); if (!el) return;
  try {
    const rows = await admin.batches(40);
    el.innerHTML = rows.length ? `<table class="tbl"><thead><tr><th>When</th><th>Note</th><th class="r">Qs</th><th></th></tr></thead><tbody>${rows.map(b => `<tr>
      <td class="num">${esc(new Date(b.created_at).toLocaleString('en-GB', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }))}</td>
      <td>${esc(b.note || b.source_filename || b.source)}${b.status !== 'active' ? ` <span class="tag mute">${esc(b.status)}</span>` : ''}</td>
      <td class="r num">${b.question_count}</td>
      <td class="r">${b.status === 'active' ? `<button class="btn small" data-rb="${b.id}">Roll back</button>` : ''}</td></tr>`).join('')}</tbody></table>` : '<p class="note">No imports yet.</p>';
    $$('[data-rb]', el).forEach(btn => btn.onclick = async () => {
      const ok = await sheet({ title: 'Roll back this import?', body: 'Questions never used in a practice are deleted. Questions Mikha already saw are only deactivated, so history stays correct.', actions: [{ label: 'Roll back', value: true, cls: 'danger' }, { label: 'Cancel', value: false }] });
      if (!ok) return;
      btn.disabled = true; btn.textContent = '…';
      try { const r = await admin.rollbackBatch(btn.dataset.rb); toast(`Deleted ${r.deleted}, deactivated ${r.deactivated}.`, 3500); renderBatches(); }
      catch (e) { toast(e.message, 4000); btn.disabled = false; btn.textContent = 'Roll back'; }
    });
  } catch (e) { el.innerHTML = `<p class="note">${esc(e.message)}</p>`; }
}
