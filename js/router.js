// Hash router: #/login #/home #/pick #/quiz/<id> #/result/<id> #/session/<id> #/history #/learn #/progress
import { $, $$ } from './ui.js';

const TABS = ['home', 'learn', 'progress', 'history'];
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
  $$('.screen').forEach(s => s.classList.toggle('active', s.id === 's-' + screen));
  const tab = TABS.includes(screen);
  $('#tabbar').hidden = !tab;
  $$('.tab').forEach(t => { const on = t.dataset.tab === screen; t.classList.toggle('on', on); t.setAttribute('aria-current', on ? 'page' : 'false'); });
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
