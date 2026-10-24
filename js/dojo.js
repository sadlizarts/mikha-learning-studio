// Dojo (v1.8.0, Sadli 21 Oct 2026): chapter bosses, dojo rank, technique cards, daily target.
// Original world (no licensed names/characters): every chapter is guarded by a spirit; beat it by mastering the chapter.
import { esc } from './ui.js';
import { monsterSVG } from './monsters.js';

export const RANKS = [
  { name: 'Initiate',    belt: 'White belt',  color: '#F4F1EA' },
  { name: 'Apprentice',  belt: 'Yellow belt', color: '#FFD233' },
  { name: 'Disciple',    belt: 'Orange belt', color: '#FF8A1F' },
  { name: 'Seeker',      belt: 'Green belt',  color: '#1FA463' },
  { name: 'Adept',       belt: 'Blue belt',   color: '#2F6FE0' },
  { name: 'Elite',       belt: 'Purple belt', color: '#7A4BE0' },
  { name: 'Master',      belt: 'Brown belt',  color: '#8A5A2B' },
  { name: 'Legendary',   belt: 'Black belt',  color: '#1B1826' },
];

export function rules(cat) {
  const R = cat?.rules || {};
  let need = R.rank_bosses; if (typeof need === 'string') try { need = JSON.parse(need); } catch { need = null; }
  let pct = R.rank_pct; if (typeof pct === 'string') try { pct = JSON.parse(pct); } catch { pct = null; }
  return {
    min: +R.min_answered || 15, win: +R.boss_threshold || 80, revive: +R.boss_revive_below || 70,
    target: +R.daily_target || 30, cap: +R.daily_cap || 90, pass: +R.exam_pass || 85,
    need: Array.isArray(need) && need.length ? need.map(Number) : [3, 6, 10, 15, 22, 30, 40],
    pct: Array.isArray(pct) && pct.length ? pct.map(Number) : [10, 20, 30, 45, 60, 75, 90],
  };
}

/* ---------- seeded randomness so each chapter always gets the same spirit ---------- */
function seedOf(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { let a = seed || 1; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
const pickR = (r, arr) => arr[Math.floor(r() * arr.length)];

const SYL = ['ka', 'zo', 'ri', 'mu', 'ga', 'ne', 'tor', 'vel', 'ra', 'ku', 'en', 'yo', 'ba', 'dru', 'sa', 'gi', 'mo', 'thar', 'vex', 'lo', 'gor', 'nyx', 'za', 'ul'];
const EPITHET = {
  math: ['Number Oni', 'Riddle Golem', 'Fraction Fiend', 'Angle Wraith', 'Equation Shade'],
  sci: ['Storm Oni', 'Element Wraith', 'Spore Shade', 'Magnet Golem', 'Atom Fiend'],
  eng: ['Word Wraith', 'Grammar Golem', 'Echo Shade', 'Ink Fiend', 'Story Oni'],
  ind: ['Kata Wraith', 'Kalimat Golem', 'Pena Shade', 'Majas Fiend', 'Gema Oni'],
  pan: ['Oath Golem', 'Banner Wraith', 'Council Shade', 'Unity Oni', 'Law Fiend'],
  aga: ['Dusk Wraith', 'Lantern Shade', 'Dune Golem', 'Mirage Oni', 'Night Fiend'],
};
const TECH_A = ['Prism', 'Thunder', 'Crimson', 'Silent', 'Iron', 'Azure', 'Ember', 'Frost', 'Lunar', 'Solar', 'Shadow', 'Jade', 'Storm', 'Echo', 'Spiral'];
const TECH_B = ['Fang', 'Seal', 'Palm', 'Arrow', 'Lotus', 'Barrier', 'Strike', 'Vortex', 'Bloom', 'Talon', 'Wave', 'Crest', 'Lance', 'Ring', 'Step'];

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
export function bossName(ch, key = 'sci', salt = '') {
  const r = rng(seedOf('boss:' + ch.code + salt));
  const n = 2 + (r() < 0.4 ? 1 : 0);
  let name = ''; for (let i = 0; i < n; i++) name += pickR(r, SYL);
  return { name: cap(name), title: pickR(r, EPITHET[key] || EPITHET.sci) };
}
export function techName(ch, salt = '') {
  const r = rng(seedOf('tech:' + ch.code + salt));
  return `${pickR(r, TECH_A)} ${pickR(r, TECH_B)}`;
}

/* ---------- state ---------- */
/** status: 'new' (never practised) | 'fight' | 'defeated' | 'revived' (beaten before, now below revive) */
export function bossState(stat, beatenEver, R) {
  const n = stat?.answered || 0, acc = stat?.accuracy_recent ?? 0;
  const beatNow = n >= R.min && acc >= R.win;
  // HP: 100 at the start; answering (up to min) and accuracy (up to win) both chip it down
  const prog = Math.min(1, n / R.min) * 0.2 + Math.max(0, Math.min(1, (acc - 40) / (R.win - 40))) * 0.8;
  const hp = beatNow ? 0 : Math.max(4, Math.round(100 * (1 - (n ? prog : 0))));
  let status = 'fight';
  if (!n) status = 'new';
  else if (beatNow) status = 'defeated';
  else if (beatenEver && acc < R.revive) status = 'revived';
  else if (beatenEver) status = 'cracked';   // beaten before, dipped a little (70–79): seal is cracking — card kept, not counted for rank
  return { status, hp, acc, n, beatNow };
}

export const cardTier = (best) => best >= 95 ? 'gold' : best >= 90 ? 'silver' : 'bronze';
export const TIER_LABEL = { gold: 'Gold', silver: 'Silver', bronze: 'Bronze' };

/** v3.3 belt path: bosses needed for the next rank = max(3, min(fixed number, pct × active chapters)).
 *  active = chapters not in the belt archive + archived ones that already count. `have` = counted bosses (sealed once, still ≥ revive line). */
export function rankInfo(rank, have, R, active = null) {
  const r = Math.max(0, Math.min(RANKS.length - 1, rank || 0));
  const fixed = R.need[r];
  const need = fixed == null ? null : active == null ? fixed : Math.max(3, Math.min(fixed, Math.ceil((R.pct?.[r] ?? 100) * active / 100)));
  return { rank: r, ...RANKS[r], next: RANKS[r + 1] || null, need, have, active, ready: need != null && have >= need };
}

/* ---------- pictures (original SVG, generated) ---------- */
/** Boss portrait (v2.0.0): delegates to the subject monster families in monsters.js. state: new | fight | defeated | minion | elite | boss | sealed */
export function bossSVG(ch, color, { state = 'fight', size = 96 } = {}) {
  const phase = state === 'defeated' ? 'sealed' : state === 'fight' ? 'boss' : state;
  return monsterSVG(ch, { phase, size });
}

export function cardSVG(ch, color, tier = 'bronze', { locked = false, size = 120 } = {}) {
  const r = rng(seedOf('card:' + ch.code));
  const n = 5 + Math.floor(r() * 4), inner = 0.35 + r() * 0.2, rot = r() * 60;
  const star = []; for (let i = 0; i < n * 2; i++) { const t = (i / (n * 2)) * Math.PI * 2 + rot * Math.PI / 180; const rr = i % 2 ? 26 * inner : 26; star.push(`${(50 + Math.cos(t) * rr).toFixed(1)},${(50 + Math.sin(t) * rr).toFixed(1)}`); }
  const rings = 1 + Math.floor(r() * 2);
  const frame = { gold: '#F5C400', silver: '#B8C2D0', bronze: '#C47A3A' }[tier];
  if (locked) return `<svg class="card-svg locked" viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true"><circle cx="50" cy="50" r="40" fill="var(--paper-2)" stroke="var(--ink-3)" stroke-width="3" stroke-dasharray="6 6"/><text x="50" y="60" text-anchor="middle" font-family="var(--display)" font-size="28" fill="var(--ink-3)">?</text></svg>`;
  return `<svg class="card-svg" viewBox="0 0 100 100" width="${size}" height="${size}" aria-hidden="true">
    <circle cx="50" cy="50" r="44" fill="${frame}" stroke="var(--ink)" stroke-width="3"/>
    <circle cx="50" cy="50" r="36" fill="${color}" stroke="var(--ink)" stroke-width="2.5"/>
    ${rings > 1 ? '<circle cx="50" cy="50" r="30" fill="none" stroke="#fff" stroke-width="1.6" stroke-dasharray="3 4" opacity=".8"/>' : ''}
    <polygon points="${star.join(' ')}" fill="#fff" stroke="var(--ink)" stroke-width="2.4" stroke-linejoin="round"/>
    <circle cx="50" cy="50" r="${(6 + r() * 4).toFixed(1)}" fill="${frame}" stroke="var(--ink)" stroke-width="2"/></svg>`;
}

export function beltSVG(color, size = 64) {
  return `<svg viewBox="0 0 64 40" width="${size}" height="${size * 40 / 64}" aria-hidden="true">
    <rect x="2" y="12" width="60" height="12" rx="3" fill="${color}" stroke="var(--ink)" stroke-width="2.5"/>
    <path d="M26 14 L20 38 L28 36 L32 22 L36 36 L44 38 L38 14Z" fill="${color}" stroke="var(--ink)" stroke-width="2.5" stroke-linejoin="round"/>
    <rect x="26" y="9" width="12" height="18" rx="3" fill="${color}" stroke="var(--ink)" stroke-width="2.5"/></svg>`;
}
