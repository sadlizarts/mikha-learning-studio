// Admin → Schedule: the school's assessment calendar. Dad links the chapters each assessment covers;
// Mikha's Home then shows readiness and a Practice button that opens exactly those chapters.
import { $, $$, esc, toast, subjectMeta, shortCode, jakartaDate } from '../../ui.js';
import { admin, loadAssessments } from '../../store.js';
import { app, catalog } from '../../state.js';
import { KIND, dateRange, phase, countdown } from '../../schedule.js';

let showPast = false;

export async function renderSchedule(body) {
  body.innerHTML = '<div class="spin"></div>';
  const [list, cat] = await Promise.all([loadAssessments({ all: true }), catalog()]);
  const today = jakartaDate();
  const rows = list.filter(a => showPast || phase(a, today) !== 'past');
  const chName = (id) => { const c = cat.chapters.find(x => x.chapter_id === id); return c ? shortCode(c.code) : '?'; };
  body.innerHTML = `<div class="stack">
    <div class="panel"><div class="row between"><h3>School assessments</h3>
      <button class="btn small" id="s-past">${showPast ? 'Hide finished' : 'Show finished'}</button></div>
      <p class="note" style="margin:4px 0 8px">Pick the chapters each assessment covers. Mikha sees the next 14 days on Home, with a Practice button for those chapters.</p>
      <table class="tbl"><thead><tr><th>When</th><th>Assessment</th><th>Chapters</th><th></th></tr></thead><tbody>
      ${rows.map(a => { const k = KIND[a.kind]; const m = subjectMeta({ name: a.subject_name });
        return `<tr class="${a.is_active ? '' : 'off'}"><td><b>${esc(countdown(a, today))}</b><div class="note">${esc(dateRange(a))} · S${a.semester ?? '-'} W${a.week ?? '-'}</div></td>
          <td><span class="tag" style="border-color:${m.color};color:${m.color}">${esc(m.short)}</span> ${esc(a.title || k.label)}<div class="note">${esc(k.sub)}${a.notes ? ' · ' + esc(a.notes) : ''}</div></td>
          <td>${(a.chapter_ids || []).map(id => `<span class="tag">${esc(chName(id))}</span>`).join('') || (k.practice ? '<span class="tag warn">not set</span>' : '<span class="tag mute">n/a</span>')}</td>
          <td class="r"><button class="btn small" data-edit="${a.id}">Edit</button></td></tr>`; }).join('')}
      </tbody></table></div>
    <div class="panel" id="s-editor" hidden></div>
    <div class="panel"><h3>Add assessment</h3>
      <div class="grid2"><div><label class="lbl" for="n-sub">Subject</label><select id="n-sub">${cat.subjects.map(s => `<option value="${s.id}">${esc(s.name)}</option>`).join('')}</select></div>
      <div><label class="lbl" for="n-kind">Type</label><select id="n-kind">${Object.entries(KIND).map(([v, k]) => `<option value="${v}">${esc(k.label)} · ${esc(k.sub)}</option>`).join('')}</select></div></div>
      <div class="grid2"><div><label class="lbl" for="n-s">From</label><input type="date" id="n-s"></div><div><label class="lbl" for="n-e">To</label><input type="date" id="n-e"></div></div>
      <label class="lbl" for="n-title">Title (optional)</label><input type="text" id="n-title" placeholder="e.g. Unit 3 quiz">
      <button class="btn primary block" id="n-add" style="margin-top:12px">Add</button>
    </div>
  </div>`;
  $('#s-past').onclick = () => { showPast = !showPast; renderSchedule(body); };
  $$('[data-edit]', body).forEach(b => b.onclick = () => openEditor(body, list.find(a => a.id === b.dataset.edit), cat));
  $('#n-add').onclick = async () => {
    const s = $('#n-s').value, e = $('#n-e').value || s;
    if (!s) { toast('Pick a start date.'); return; }
    if (e < s) { toast('End date is before the start date.'); return; }
    try {
      await admin.addAssessment({ subject_id: $('#n-sub').value, kind: $('#n-kind').value, date_start: s, date_end: e, title: $('#n-title').value.trim() || null, created_by: app.user.id });
      toast('Added.'); renderSchedule(body);
    } catch (err) { toast(err.message, 4000); }
  };
}

function openEditor(body, a, cat) {
  const ed = $('#s-editor', body);
  const k = KIND[a.kind];
  const chs = cat.chapters.filter(c => c.subject_id === a.subject_id);
  const sel = new Set(a.chapter_ids || []);
  ed.hidden = false;
  ed.innerHTML = `<h3>${esc(a.subject_name)} · ${esc(a.title || k.label)}</h3><div class="note">${esc(dateRange(a))} · ${esc(k.sub)}</div>
    ${k.practice ? `<label class="lbl">Chapters covered</label><div class="stack" style="gap:4px">${chs.map(c => `<label class="row" style="gap:8px;font-weight:700"><input type="checkbox" data-ch="${c.chapter_id}" ${sel.has(c.chapter_id) ? 'checked' : ''}> ${esc(shortCode(c.code))} · ${esc(c.name)}</label>`).join('') || '<p class="note">No chapters for this subject yet.</p>'}</div>` : '<p class="note">EASE Growth is a benchmark test: no chapters to link.</p>'}
    <div class="grid2"><div><label class="lbl" for="e-s">From</label><input type="date" id="e-s" value="${a.date_start}"></div><div><label class="lbl" for="e-e">To</label><input type="date" id="e-e" value="${a.date_end}"></div></div>
    <label class="lbl" for="e-title">Title (optional)</label><input type="text" id="e-title" value="${esc(a.title || '')}" placeholder="${esc(k.label)}">
    <label class="lbl" for="e-notes">Note for Mikha (optional)</label><input type="text" id="e-notes" value="${esc(a.notes || '')}" placeholder="e.g. bring a calculator">
    <label class="row" style="gap:8px;margin-top:10px;font-weight:700"><input type="checkbox" id="e-active" ${a.is_active ? 'checked' : ''}> Show on Mikha's calendar</label>
    <div class="row" style="margin-top:12px"><button class="btn primary grow" id="e-save">Save</button><button class="btn" id="e-cancel">Cancel</button></div>`;
  ed.scrollIntoView({ behavior: 'smooth', block: 'start' });
  $('#e-cancel', ed).onclick = () => { ed.hidden = true; };
  $('#e-save', ed).onclick = async () => {
    const s = $('#e-s', ed).value, e = $('#e-e', ed).value;
    if (!s || !e || e < s) { toast('Check the dates.'); return; }
    try {
      await admin.updateAssessment(a.id, {
        chapter_ids: $$('[data-ch]', ed).filter(x => x.checked).map(x => x.dataset.ch),
        date_start: s, date_end: e, title: $('#e-title', ed).value.trim() || null, notes: $('#e-notes', ed).value.trim() || null,
        is_active: $('#e-active', ed).checked, updated_at: new Date().toISOString(),
      });
      toast('Saved.'); renderSchedule(body);
    } catch (err) { toast(err.message, 4000); }
  };
}
