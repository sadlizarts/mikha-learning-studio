// Shared admin helpers: chapter picker, tags, question editor.
import { $, esc, sheet, toast, subjectMeta, shortCode } from '../../ui.js';
import { admin, stemHash } from '../../store.js';

export function chapterOptions(cat, selected = '', { includeAll = false, allLabel = 'All chapters' } = {}) {
  const bySub = cat.subjects.map(s => ({ s, ch: cat.chapters.filter(c => c.subject_id === s.id) }));
  return (includeAll ? `<option value="">${esc(allLabel)}</option>` : '') + bySub.map(({ s, ch }) =>
    `<optgroup label="${esc(s.name)}">${ch.map(c => `<option value="${c.chapter_id}" ${c.chapter_id === selected ? 'selected' : ''}>${esc(shortCode(c.code))} · ${esc(c.name)} (${c.active_questions})</option>`).join('')}</optgroup>`).join('');
}

export function chapterLabel(idx, id) {
  const c = idx[id]; if (!c) return '—';
  return `${subjectMeta(c.subject).short} ${shortCode(c.code)} · ${c.name}`;
}

export function qTags(q, st) {
  const t = [];
  t.push(q.is_active ? '<span class="tag ok">active</span>' : '<span class="tag mute">inactive</span>');
  if (q.source && q.source !== 'mls') t.push(`<span class="tag mute">${esc(q.source)}</span>`);
  if (q.qc_tier) t.push(`<span class="tag">tier ${esc(q.qc_tier)}</span>`);
  (q.qc_flags || []).forEach(f => t.push(`<span class="tag warn">${esc(f)}</span>`));
  if (st && st.times_answered) t.push(`<span class="tag ${st.wrong_rate >= 70 ? 'bad' : ''}">${st.wrong_rate}% wrong · ${st.times_answered}×</span>`);
  return t.join('');
}

const field = (label, html) => `<label class="lbl">${label}</label>${html}`;
const ta = (id, v, rows = 3) => `<textarea id="${id}" rows="${rows}">${esc(v ?? '')}</textarea>`;

/** Full-screen editor. Resolves true when something was saved/deleted. */
export function openEditor(q, { idx, stats } = {}) {
  return new Promise(resolve => {
    const hints = Array.isArray(q.hints) ? q.hints : [];
    const el = document.createElement('div');
    el.className = 'editor admin';
    el.innerHTML = `
      <div class="top"><button class="back" data-x aria-label="Close">×</button><h2 style="font-size:22px">Edit question</h2></div>
      <div class="scroll no-tab"><div class="stack" style="gap:6px">
        <div class="note">${esc(chapterLabel(idx || {}, q.chapter_id))} · ${qTags(q, stats)}</div>
        ${stats?.times_answered ? `<div class="note">Answers so far: ${['A', 'B', 'C', 'D'].map(k => `${k} ${stats.choice_dist?.[k] ?? 0}`).join(' · ')} (key ${esc(q.answer_key)})</div>` : ''}
        ${field('Read-this-first text (context)', ta('e-ctx', q.context, 3))}
        ${field('Question', ta('e-stem', q.stem, 4))}
        ${['A', 'B', 'C', 'D'].map(k => field(`Option ${k}`, `<input type="text" id="e-o${k}" value="${esc(q.options?.[k] ?? '')}">`)).join('')}
        <div class="grid2">
          <div>${field('Correct answer', `<select id="e-key">${['A', 'B', 'C', 'D'].map(k => `<option ${k === q.answer_key ? 'selected' : ''}>${k}</option>`).join('')}</select>`)}</div>
          <div>${field('Difficulty', `<select id="e-diff">${['easy', 'medium', 'hard'].map(k => `<option ${k === q.difficulty ? 'selected' : ''}>${k}</option>`).join('')}</select>`)}</div>
        </div>
        ${field('Explanation', ta('e-exp', q.explanation, 4))}
        ${field('Hint 1 · Remember', ta('e-h1', hints[0], 2))}
        ${field('Hint 2 · Next step (optional)', ta('e-h2', hints[1], 2))}
        <label class="row" style="margin-top:10px;gap:8px;font-weight:800;color:var(--ink)"><input type="checkbox" id="e-lock" ${q.lock_options ? 'checked' : ''}> Keep option order (for "all of the above")</label>
        <label class="row" style="gap:8px;font-weight:800;color:var(--ink)"><input type="checkbox" id="e-active" ${q.is_active ? 'checked' : ''}> Active (Mikha can get this question)</label>
        ${(q.qc_flags || []).length ? `<label class="row" style="gap:8px;font-weight:800;color:var(--ink)"><input type="checkbox" id="e-clear"> Clear QC flags (${esc(q.qc_flags.join(', '))}) — I fixed them</label>` : ''}
        <p class="note" style="margin-top:8px">Text changes show everywhere, including past sessions.</p>
      </div></div>
      <div class="bar"><button class="btn small" data-del style="color:var(--bad)">Delete…</button><span class="grow"></span><button class="btn" data-x>Cancel</button><button class="btn primary" data-save>Save</button></div>`;
    const close = (v) => { el.remove(); resolve(v); };
    el.addEventListener('click', async e => {
      if (e.target.closest('[data-x]')) return close(false);
      if (e.target.closest('[data-save]')) {
        const v = (id) => $(id, el).value.trim();
        const options = { A: v('#e-oA'), B: v('#e-oB'), C: v('#e-oC'), D: v('#e-oD') };
        const stem = v('#e-stem'), explanation = v('#e-exp'), context = v('#e-ctx');
        const errs = [];
        if (!stem) errs.push('Question is empty.');
        if (Object.values(options).some(o => !o)) errs.push('All four options are needed.');
        if (new Set(Object.values(options).map(o => o.toLowerCase())).size < 4) errs.push('Two options are the same.');
        if (!explanation) errs.push('Explanation is empty.');
        if (context && (context.length < 40 || context.length > 1200)) errs.push('Context must be 40–1200 characters (or empty).');
        if (stem.length > 1500) errs.push('Question is longer than 1500 characters.');
        if (errs.length) { toast(errs.join(' '), 3500); return; }
        const patch = {
          stem, options, explanation, answer_key: v('#e-key'), difficulty: v('#e-diff'),
          hints: [v('#e-h1'), v('#e-h2')].filter(Boolean), context: context || null,
          context_id: context ? (q.context_id || 'ctx-' + (await stemHash(context)).slice(0, 10)) : null,
          lock_options: $('#e-lock', el).checked, is_active: $('#e-active', el).checked,
        };
        if ($('#e-clear', el)?.checked) patch.qc_flags = [];
        if (stem !== q.stem) patch.stem_hash = await stemHash(stem);
        const keyChanged = patch.answer_key !== q.answer_key;
        try {
          await admin.updateQuestion(q.id, patch);
          if (keyChanged && stats?.times_answered) {
            const re = await sheet({ title: 'Re-grade past answers?', body: `${stats.times_answered} past answers were graded with the old key (${esc(q.answer_key)}). Re-grade them with ${esc(patch.answer_key)}? Scores change; XP already given stays.`, actions: [{ label: 'Re-grade', value: true, cls: 'primary' }, { label: 'Leave them', value: false }] });
            if (re) { const n = await admin.regrade(q.id); toast(`Re-graded ${n} answers.`); }
          }
          toast('Saved.'); close(true);
        } catch (ex) { toast(/duplicate|unique/i.test(ex.message) ? 'Another question in this chapter already has the same text.' : ex.message, 4000); }
      }
      if (e.target.closest('[data-del]')) {
        try {
          const used = await admin.usageCount(q.id);
          if (used) {
            const ok = await sheet({ title: 'Can\'t delete — already used', body: `This question appeared in ${used} practice session${used > 1 ? 's' : ''}, so it stays in history. Deactivate it instead?`, actions: [{ label: 'Deactivate', value: true, cls: 'danger' }, { label: 'Keep it', value: false }] });
            if (ok) { await admin.updateQuestion(q.id, { is_active: false }); toast('Deactivated.'); close(true); }
          } else {
            const ok = await sheet({ title: 'Delete this question?', body: 'It has never been used in a practice. This cannot be undone.', actions: [{ label: 'Delete', value: true, cls: 'danger' }, { label: 'Keep it', value: false }] });
            if (ok) { await admin.deleteQuestion(q.id); toast('Deleted.'); close(true); }
          }
        } catch (ex) { toast(ex.message, 4000); }
      }
    });
    $('#app').appendChild(el);
  });
}
