// Hash router: #/login #/home #/pick #/quiz/<id> #/result/<id> #/session/<id> #/history #/learn #/progress #/dojo
import { $, $$ } from './ui.js';

const TABS = ['home', 'dojo', 'learn', 'progress', 'history'];
const TAB_ALIAS = { hero: 'dojo', bosses: 'dojo' };
const NIGHT = ['login', 'home', 'pick', 'quiz', 'result', 'session', 'history', 'learn', 'lesson', 'schedule', 'progress', 'dojo', 'hero', 'bosses'];   // v2.3: every student screen is Night Dojo; admin stays light   // Night Dojo screens (dark theme, v2.0.0)   // sub-screens that keep their parent tab lit
const routes = {};
let guard = () => true;
let current = null;

export const route = (name, fn) => { routes[name] = fn; };
export const setGuard = (fn) => { guard = fn; };
export const navigate = (hash, { replace = false } = {}) => {
  if (location.hash === hash) { handle(); return; }
  if (replace) history.replaceState(null, '', hash); else location.hash = hash;
  if (replace) handle();
};
export const currentRoute = () => current;

export function show(screen) {
  document.documentElement.classList.toggle('wide', screen === 'admin');
  $$('.screen').forEach(s => s.classList.toggle('active', s.id === 's-' + screen));
  document.documentElement.classList.toggle('nd-on', NIGHT.includes(screen));
  const tabName = TAB_ALIAS[screen] || screen;
  const tab = TABS.includes(tabName);
  $('#tabbar').hidden = !tab;
  document.documentElement.classList.toggle('has-tabs', tab);
  $$('.tab').forEach(t => { const on = t.dataset.tab === tabName; t.classList.toggle('on', on); t.setAttribute('aria-current', on ? 'page' : 'false'); });
  $('#toast').style.bottom = tab ? '' : 'calc(16px + env(safe-area-inset-bottom,0px))';
}

async function handle() {
  const [name = 'home', ...rest] = (location.hash.replace(/^#\/?/, '') || 'home').split('/');
  const target = routes[name] ? name : 'home';
  const allowed = await guard(target);
  if (allowed !== true) { if (typeof allowed === 'string' && allowed !== location.hash) navigate(allowed, { replace: true }); return; }
  current = { name: target, params: rest };
  try { await routes[target](...rest); } catch (e) { console.error(e); }
}

export function startRouter() {
  window.addEventListener('hashchange', handle);
  document.addEventListener('click', e => {
    const n = e.target.closest('[data-nav]');
    if (n) { e.preventDefault(); navigate(n.dataset.nav); }
  });
  handle();
}
