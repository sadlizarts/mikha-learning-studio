// History (DESIGN §5.7): every finished practice; tap opens the read-only result.
import { $, esc } from '../ui.js';
import { completedAttempts } from '../store.js';
import { app, catalog, chapterIndex } from '../state.js';
import { show } from '../router.js';
import { recRow } from './home.js';

export async function renderHistory() {
  show('history');
  const list = $('#historylist');
  list.innerHTML = '<div class="loading" style="height:30vh"><div class="spin"></div></div>';
  try {
    const [cat, rows] = await Promise.all([catalog(), completedAttempts(app.user.id, 200)]);
    const idx = chapterIndex(cat);
    list.innerHTML = rows.length ? rows.map(a => recRow(a, idx)).join('')
      : '<div class="panel sunk empty">No battles yet. Your first practice unlocks this page.<button class="btn primary block" style="margin-top:12px" data-nav="#/pick">Pick chapters →</button></div>';
  } catch (e) {
    list.innerHTML = `<div class="panel sunk empty">${esc(e.message)}</div>`;
  }
}
