// Shared UI helpers: escaping, mascot, toasts, bottom sheets, formatting.

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* Nib — original mascot (DESIGN §3). Uses tokens so it follows the theme. */
export function mascotSVG(mood = 'neutral') {
  const mouth = { neutral: 'M26 44 q6 4 12 0', happy: 'M24 42 q8 10 16 0', sad: 'M25 47 q7 -6 14 0', think: 'M27 45 h10' }[mood] || 'M26 44 q6 4 12 0';
  const brow = mood === 'sad' ? '<path d="M20 28 l8 4 M44 28 l-8 4" stroke="var(--ink)" stroke-width="2.5" stroke-linecap="round"/>'
    : mood === 'think' ? '<path d="M20 30 l8 -2" stroke="var(--ink)" stroke-width="2.5" stroke-linecap="round"/>' : '';
  return `<svg viewBox="0 0 64 64" aria-hidden="true">
   <path d="M32 4 C40 18 54 24 54 40 a22 22 0 0 1 -44 0 C10 24 24 18 32 4z" fill="var(--ink)" stroke="var(--ink)" stroke-width="3" stroke-linejoin="round"/>
   <path d="M32 10 C38 20 48 26 48 40 a16 16 0 0 1 -32 0 C16 26 26 20 32 10z" fill="var(--ember)"/>
   <path d="M14 34 h36 l-2 7 h-32z" fill="var(--volt)" stroke="var(--ink)" stroke-width="2.5" stroke-linejoin="round"/>
   <path d="M50 35 l9 -4 -3 8z" fill="var(--volt)" stroke="var(--ink)" stroke-width="2.5" stroke-linejoin="round"/>
   <g class="eye"><circle cx="25" cy="37" r="3.2" fill="#fff"/><circle cx="39" cy="37" r="3.2" fill="#fff"/><circle cx="25.6" cy="37.4" r="1.6" fill="#1B1826"/><circle cx="39.6" cy="37.4" r="1.6" fill="#1B1826"/></g>
   ${brow}
   <path d="${mouth}" fill="none" stroke="#fff" stroke-width="2.5" stroke-linecap="round"/>
  </svg>`;
}
export function setMascot(el, mood, anim) {
  if (!el) return;
  el.innerHTML = mascotSVG(mood);
  el.classList.remove('happy', 'sad');
  if (anim) { void el.offsetWidth; el.classList.add(anim); }
}

export const FLAME = '<svg class="flame" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2c1 4 5 5 5 11a5 5 0 0 1-10 0c0-2 1-3 1-3s0 3 2 3c1 0 1-2 0-5 2 1 2 3 2 3s2-3 0-9z" fill="var(--ember)" stroke="var(--ink)" stroke-width="1.6" stroke-linejoin="round"/></svg>';
export const BULB = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-4 10.5c.8.8 1 1.5 1 2.5h6c0-1 .2-1.7 1-2.5A6 6 0 0 0 12 3z"/></svg>';

/* ---------- toast ---------- */
let toastTimer;
export function toast(msg, ms = 1800) {
  const t = $('#toast');
  t.textContent = msg; t.classList.add('show');
  if (document.querySelector('.editor')) t.style.bottom = 'calc(84px + env(safe-area-inset-bottom,0px))';
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

/* ---------- bottom sheet (no alert/confirm/prompt — CLAUDE.md) ---------- */
export function sheet({ title, body = '', actions = [] }) {
  return new Promise(resolve => {
    const wrap = document.createElement('div');
    wrap.className = 'sheet';
    wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-modal', 'true'); wrap.setAttribute('aria-label', title);
    wrap.innerHTML = `<div class="panel"><h3>${esc(title)}</h3>${body ? `<p>${body}</p>` : ''}
      <div class="stack" style="gap:10px">${actions.map((a, i) => `<button class="btn block ${a.cls || ''}" data-i="${i}">${esc(a.label)}</button>`).join('')}</div></div>`;
    const close = (v) => { wrap.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
    const onKey = (e) => { if (e.key === 'Escape') close(null); };
    wrap.addEventListener('click', e => {
      const b = e.target.closest('[data-i]');
      if (b) close(actions[+b.dataset.i].value);
      else if (e.target === wrap) close(null);
    });
    document.addEventListener('keydown', onKey);
    $('#app').appendChild(wrap);
    wrap.querySelector('[data-i]')?.focus();
  });
}

/* ---------- subjects ---------- */
const SUBJECT_META = {
  'Science': { key: 'sci', short: 'Science' },
  'Mathematics': { key: 'math', short: 'Math' },
  'English': { key: 'eng', short: 'English' },
  'Bahasa Indonesia': { key: 'ind', short: 'B. Indonesia' },
  'Pendidikan Pancasila': { key: 'pan', short: 'Pancasila' },
  'Pendidikan Agama': { key: 'aga', short: 'Agama' },
};
export function subjectMeta(s) {
  const m = SUBJECT_META[s?.name] || { key: 'sci', short: s?.name || '' };
  return { ...m, color: `var(--sub-${m.key})` };
}
/** "S7-U2" -> "U2", "PAI7-B10" -> "B10", "E8-R12" -> "R12" */
export const shortCode = (code) => String(code || '').split('-').pop();

/* ---------- formatting (Asia/Jakarta, PRD §9.3) ---------- */
const TZ = 'Asia/Jakarta';
export const jakartaDate = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(d));
export const prettyDay = (d = new Date()) => new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'short' }).format(new Date(d));
export const shortDay = (d) => new Intl.DateTimeFormat('en-GB', { timeZone: TZ, weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(d));
export const fmtDur = (s) => { s = Math.max(0, Math.round(s || 0)); const m = Math.floor(s / 60); return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}:${String(s % 60).padStart(2, '0')}`; };
export const fmtNum = (n) => new Intl.NumberFormat('en-US').format(n || 0);
export const scoreCls = (s) => s >= 85 ? 'good' : s >= 65 ? 'mid' : 'low';
export function band(score) {
  if (score >= 90) return ['EXCELLENT', 'ok'];
  if (score >= 75) return ['GOOD', 'ok'];
  if (score >= 60) return ['KEEP GOING', 'mid'];
  return ['NEEDS WORK', 'bad'];
}
/* Level formula PRD §9.2: XP needed for level L = 150·(L−1)·L */
export const xpForLevel = (L) => 150 * (L - 1) * L;
export function levelInfo(xp) {
  let L = 1; while (xpForLevel(L + 1) <= xp) L++;
  const from = xpForLevel(L), to = xpForLevel(L + 1);
  const tier = L >= 10 ? 'Master' : L >= 7 ? 'Expert' : L >= 5 ? 'Scholar' : L >= 3 ? 'Learner' : 'Rookie';
  return { level: L, tier, pct: Math.round(100 * (xp - from) / (to - from)), toNext: to - xp };
}
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/* score trend (DESIGN §5.6): Ember area 12 %, Ember line 3 px, last point Volt, dashed red line at the Needs-work threshold */
export function trendSVG(scores, threshold = 70, { W = 520, H = 130 } = {}) {
  if (scores.length < 2) return '<p class="note">The trend appears after 2 finished practices.</p>';
  const P = 10, n = scores.length;
  const x = (i) => P + i * (W - 2 * P) / (n - 1), y = (s) => H - P - s * (H - 2 * P) / 100;
  const pts = scores.map((s, i) => `${x(i).toFixed(1)},${y(s).toFixed(1)}`).join(' ');
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" role="img" aria-label="Last ${n} scores: ${scores.join(', ')}">
    <line x1="${P}" x2="${W - P}" y1="${y(threshold)}" y2="${y(threshold)}" stroke="var(--bad)" stroke-width="1.5" stroke-dasharray="5 5"/>
    <text x="${W - P}" y="${y(threshold) - 4}" text-anchor="end" font-size="11" font-weight="800" fill="var(--bad)">${threshold}</text>
    <polygon points="${x(0)},${H - P} ${pts} ${x(n - 1)},${H - P}" fill="var(--ember)" opacity=".12"/>
    <polyline points="${pts}" fill="none" stroke="var(--ember)" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>
    <circle cx="${x(n - 1)}" cy="${y(scores[n - 1])}" r="6" fill="var(--volt)" stroke="var(--ink)" stroke-width="2"/></svg>`;
}
