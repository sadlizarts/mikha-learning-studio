// Admin shell: #/admin/<tab>. Only for profiles.role = 'admin' (RLS enforces it server-side too).
import { $, $$, esc } from '../../ui.js';
import { app } from '../../state.js';
import { show, navigate } from '../../router.js';
import { renderImport } from './import.js';
import { renderQuestions } from './questions.js';
import { renderReview } from './review.js';
import { renderStudent } from './student.js';
import { renderSubjects } from './subjects.js';
import { renderGoals } from './goals.js';
import { renderLessons } from './lessons.js';
import { renderSchedule } from './schedule.js';
import { renderViewer } from './viewer.js';
import { renderDojoAdmin } from './dojo.js';
import { renderHeroStudio } from './hero.js';
import { renderOverview } from './overview.js';
import { renderContent } from './content.js';

const TABS = { overview: renderOverview, content: renderContent, import: renderImport, questions: renderQuestions, lessons: renderLessons, review: renderReview, student: renderStudent, subjects: renderSubjects, dojo: renderDojoAdmin, hero: renderHeroStudio, goals: renderGoals, schedule: renderSchedule, viewer: renderViewer };

// v2.7.0: three groups instead of 11 flat tabs (labels in Bahasa Indonesia; admin is Dad's)
const GROUPS = [
  { key: 'mikha', label: 'Mikha', tabs: [['overview', 'Ringkasan'], ['dojo', 'Dojo'], ['goals', 'Target'], ['schedule', 'Jadwal'], ['student', 'Detail']] },
  { key: 'content', label: 'Konten', tabs: [['content', 'Ringkasan'], ['import', 'Impor'], ['review', 'Perlu dicek'], ['questions', 'Bank soal'], ['lessons', 'Materi'], ['subjects', 'Mapel & bab'], ['viewer', 'Lihat soal']] },
  { key: 'studio', label: 'Studio', tabs: [['hero', 'Hero studio']] },
];

export async function renderAdmin(tab = 'overview') {
  if (app.profile?.role !== 'admin') { navigate('#/home', { replace: true }); return; }
  if (!TABS[tab]) tab = 'overview';
  show('admin');
  const g = GROUPS.find(x => x.tabs.some(([k]) => k === tab)) || GROUPS[0];
  $('#aseg').innerHTML = GROUPS.map(x => `<button data-nav="#/admin/${x.tabs[0][0]}" class="${x === g ? 'on' : ''}" aria-current="${x === g ? 'page' : 'false'}">${x.label}</button>`).join('');
  $('#asub').innerHTML = g.tabs.length > 1 ? g.tabs.map(([k, l]) => `<button data-nav="#/admin/${k}" class="${k === tab ? 'on' : ''}" aria-current="${k === tab ? 'page' : 'false'}">${esc(l)}</button>`).join('') : '';
  $('#asub').hidden = g.tabs.length <= 1;
  $('#asub .on')?.scrollIntoView({ block: 'nearest', inline: 'center' });
  const body = $('#admin-body');
  body.scrollTop = 0;
  try { await TABS[tab](body); }
  catch (e) { console.error(e); body.innerHTML = `<div class="panel sunk empty">${esc(e.message)}</div>`; }
}
