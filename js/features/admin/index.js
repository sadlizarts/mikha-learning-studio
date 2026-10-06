// Admin shell: #/admin/<tab>. Only for profiles.role = 'admin' (RLS enforces it server-side too).
import { $, $$, esc } from '../../ui.js';
import { app } from '../../state.js';
import { show, navigate } from '../../router.js';
import { renderImport } from './import.js';
import { renderQuestions } from './questions.js';
import { renderReview } from './review.js';
import { renderStudent } from './student.js';
import { renderGoals } from './goals.js';
import { renderLessons } from './lessons.js';

const TABS = { import: renderImport, questions: renderQuestions, lessons: renderLessons, review: renderReview, student: renderStudent, goals: renderGoals };

export async function renderAdmin(tab = 'import') {
  if (app.profile?.role !== 'admin') { navigate('#/home', { replace: true }); return; }
  if (!TABS[tab]) tab = 'import';
  show('admin');
  $$('#atabs button').forEach(b => { const on = b.dataset.a === tab; b.classList.toggle('on', on); b.setAttribute('aria-current', on ? 'page' : 'false'); });
  const body = $('#admin-body');
  body.scrollTop = 0;
  try { await TABS[tab](body); }
  catch (e) { console.error(e); body.innerHTML = `<div class="panel sunk empty">${esc(e.message)}</div>`; }
}
