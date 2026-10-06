// Pick chapters (DESIGN §5.3, PRD FR-11..FR-13, FR-20, FR-25a, FR-27).
import { $, $$, esc, subjectMeta, shortCode, sheet, toast } from '../ui.js';
import { startAttempt, inProgressAttempt, abandonAttempt, prefs } from '../store.js';
import { app, catalog } from '../state.js';
import { show, navigate } from '../router.js';

let cat = null;
let curSub = null;
const sel = new Set(prefs.get('lastChapters', []));
let len = prefs.get('lastLen', 30);
let busy = false;

const avail = (c) => c.distinct_items || 0;
function available() {
  return cat.chapters.filter(c => sel.has(c.chapter_id)).reduce((t, c) => t + avail(c), 0);
}

function renderSubtabs() {
  $('#subtabs').innerHTML = cat.subjects.map(s => {
    const m = subjectMeta(s);
    const n = cat.chapters.filter(c => c.subject_id === s.id && sel.has(c.chapter_id)).length;
    const on = s.id === curSub;
    return `<button class="subtab ${on ? 'on' : ''}" style="--c:${m.color}" data-sub="${s.id}" role="tab" aria-selected="${on}">${esc(m.short)}${n ? ` <span class="cnt num">${n}</span>` : ''}</button>`;
  }).join('');
}

function renderChapters() {
  const s = cat.subjects.find(x => x.id === curSub);
  const m = subjectMeta(s);
  const rows = cat.chapters.filter(c => c.subject_id === curSub);
  $('#chaplist').innerHTML = rows.map(c => {
    const n = avail(c), on = sel.has(c.chapter_id), off = n === 0;
    const st = cat.statBy[c.chapter_id];
    const acc = st && st.answered > 0 ? st.accuracy_recent : null;
    const meta = off ? 'No questions yet' : `${n} questions${acc === null ? ' · <span class="new">NEW</span>' : ''}`;
    return `<button class="chap ${on ? 'on' : ''}" style="--c:${m.color}" data-ch="${c.chapter_id}" ${off ? 'disabled' : ''} aria-pressed="${on}">
      <div class="code">${esc(shortCode(c.code))}</div>
      <div class="grow"><div class="name">${esc(c.name)}</div><div class="meta num">${meta}</div></div>
      ${acc !== null ? `<div class="acc num ${acc < (+cat.rules?.needs_work_threshold || 70) ? 'bad' : 'ok'}" title="Last 30 answers">${acc}%</div>` : ''}
      <div class="box" aria-hidden="true"></div></button>`;
  }).join('') || '<div class="panel sunk empty">No chapters here yet.</div>';
  updateMeta();
}

function updateMeta() {
  const n = sel.size, t = available();
  $('#pickmeta').textContent = `${n} chapter${n === 1 ? '' : 's'} · ${t} questions available`;
  const fifty = $('[data-len="50"]');
  fifty.disabled = n > 0 && t < 50;
  if (fifty.disabled && len === 50) setLen(30);
  const b = $('#startbtn');
  const count = Math.min(len, t);
  b.disabled = n === 0 || t < 10 || busy;
  b.textContent = busy ? 'Getting questions…' : n === 0 ? 'Pick at least one chapter' : t < 10 ? 'Not enough questions yet' : `Start ${count} questions →`;
  const w = $('#pickwarn');
  w.hidden = !(n > 0 && t >= 10 && t < len);
  if (!w.hidden) w.textContent = `Only ${t} questions in these chapters, so this practice will have ${t}.`;
}

function setLen(v) {
  len = v; prefs.set('lastLen', v);
  $$('.len').forEach(x => { const on = +x.dataset.len === v; x.classList.toggle('on', on); x.setAttribute('aria-checked', on); });
}

async function start() {
  if (busy) return;
  const ids = cat.chapters.filter(c => sel.has(c.chapter_id)).map(c => c.chapter_id);
  busy = true; updateMeta();
  try {
    let data;
    try {
      data = await startAttempt(ids, len);
    } catch (e) {
      if (e.code !== 'in_progress') throw e;
      const ip = await inProgressAttempt(app.user.id);
      const choice = await sheet({
        title: 'You have a practice in progress',
        body: ip ? `${ip.answered_count}/${ip.total_questions} answered. Continue it, or start fresh?` : 'Continue it, or start fresh?',
        actions: [{ label: 'Continue it', value: 'continue', cls: 'primary' }, { label: 'Start fresh', value: 'fresh' }],
      });
      if (choice === 'continue' && ip) { navigate(`#/quiz/${ip.id}`); return; }
      if (choice !== 'fresh') return;
      if (ip) await abandonAttempt(ip.id);
      data = await startAttempt(ids, len);
    }
    prefs.set('lastChapters', ids);
    navigate(`#/quiz/${data.attempt.id}`);
  } catch (e) {
    toast(e.message, 3500);
  } finally {
    busy = false; if (cat) updateMeta();
  }
}

export async function renderPick() {
  show('pick');
  $('#chaplist').innerHTML = '<div class="loading" style="height:30vh"><div class="spin"></div></div>';
  try { cat = await catalog(true); } catch (e) { $('#chaplist').innerHTML = `<div class="panel sunk empty">${esc(e.message)}</div>`; return; }
  // drop remembered chapters that no longer exist or are empty
  for (const id of [...sel]) { const c = cat.chapters.find(x => x.chapter_id === id); if (!c || !avail(c)) sel.delete(id); }
  if (!curSub || !cat.subjects.some(s => s.id === curSub)) {
    const firstSel = cat.chapters.find(c => sel.has(c.chapter_id));
    curSub = firstSel ? firstSel.subject_id : cat.subjects[0]?.id;
  }
  setLen(len);
  renderSubtabs(); renderChapters();
}

/* events (bound once) */
$('#subtabs').addEventListener('click', e => {
  const b = e.target.closest('[data-sub]'); if (!b) return;
  curSub = b.dataset.sub; renderSubtabs(); renderChapters();
  b.scrollIntoView({ block: 'nearest', inline: 'nearest' });
});
$('#chaplist').addEventListener('click', e => {
  const b = e.target.closest('[data-ch]'); if (!b) return;
  const id = b.dataset.ch; sel.has(id) ? sel.delete(id) : sel.add(id);
  renderSubtabs(); renderChapters();
});
$$('.len').forEach(b => b.addEventListener('click', () => { setLen(+b.dataset.len); updateMeta(); }));
$('#startbtn').addEventListener('click', start);
