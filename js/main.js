// Boot: session → route guard → screens. No build step (CLAUDE.md).
import { $, $$, setMascot, toast } from './ui.js';
import { getSession, onAuthChange } from './store.js';
import { app, setSession } from './state.js';
import { route, setGuard, startRouter, show, navigate } from './router.js';
import { renderLogin } from './auth.js';
import { renderHome } from './features/home.js';
import { renderPick } from './features/pick.js';
import { renderQuiz } from './features/quiz.js';
import { renderResult } from './features/result.js';
import { renderHistory } from './features/history.js';
import { renderProgress } from './features/progress.js';
import { renderAdmin } from './features/admin/index.js';

window.MLS = { app };

async function boot() {
  try {
    const s = await getSession();
    if (s) await setSession(s);
  } catch (e) { console.warn(e); }

  onAuthChange((evt, session) => {
    if (evt === 'SIGNED_OUT') { app.session = null; app.user = null; navigate('#/login', { replace: true }); }
    else if (session) app.session = session;
  });

  setGuard(async (name) => {
    if (name === 'login') return app.user ? '#/home' : true;
    return app.user ? true : '#/login';
  });

  route('login', () => renderLogin(setSession));
  route('home', renderHome);
  route('pick', renderPick);
  route('quiz', renderQuiz);
  route('result', (id) => renderResult(id, { fresh: true }));
  route('session', (id) => renderResult(id, { fresh: false }));
  route('history', renderHistory);
  route('progress', renderProgress);
  route('admin', renderAdmin);
  route('learn', () => { show('learn'); $$('[data-mascot]').forEach(el => setMascot(el, el.dataset.mascot)); });

  startRouter();
}

/* offline banner (FR-72) */
function netState() { $('#offline').hidden = navigator.onLine; }
window.addEventListener('online', () => { netState(); toast('Back online.'); });
window.addEventListener('offline', netState);
netState();

/* service worker (app shell only; never caches Supabase) */
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

boot();
