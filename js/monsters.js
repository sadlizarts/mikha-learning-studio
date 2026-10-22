// Monster families (v2.0.0): six original subject families; each chapter is a seeded variant of its family.
// A chapter's guardian grows through phases as Mikha practises: Minion → Elite → Boss → Sealed (plus a "Came back" Boss).
// Exam Gate Bosses guard each belt. All shapes are original vector art (no licensed characters).

export const FAMILIES = {
  math: { name: 'Logic Constructs', lore: 'Crystal beings born from logic and patterns. They turn numbers and shapes into power.', c: '#3D7BFF', d: '#183A94', g: '#A8D4FF', forms: ['Cube Bit', 'Shard Sentinel', 'Crystal Golem', 'Theorem Warlord'] },
  sci: { name: 'Elemental Lifeforms', lore: 'Life shaped by elements and experiments. Even a small spark can grow into a new world.', c: '#2FD39A', d: '#0B6B4C', g: '#C9FFEA', forms: ['Sproutling', 'Crystal Sprout', 'Grove Golem', 'Grove Sovereign'] },
  eng: { name: 'Story Phantoms', lore: 'Phantoms born from stories and words. They turn language into magic.', c: '#9B6BFF', d: '#3F2496', g: '#E6DAFF', forms: ['Ink Hood', 'Book Wraith', 'Scroll Wraith', 'Lexicon Lord'] },
  ind: { name: 'Narrative Spirits', lore: 'Masked fire-spirits of stories and imagination that guard culture and meaning.', c: '#FF5A5F', d: '#8E1A27', g: '#FFD3C7', forms: ['Api Wisp', 'Topeng Imp', 'Topeng Dancer', 'Hikayat Sovereign'] },
  pan: { name: 'Law Sentinels', lore: 'Sentinels of the five principles: justice, harmony, unity, deliberation and welfare.', c: '#FFB627', d: '#8A5200', g: '#FFE8A6', forms: ['Bolt Sentry', 'Shield Squire', 'Oath Knight', 'Justice Seraph'] },
  aga: { name: 'Virtue Spirits', lore: 'Spirits of virtue and reflection: balance, compassion and the light that guides.', c: '#36C9D3', d: '#0C5E68', g: '#D2F8FB', forms: ['Little Acolyte', 'Orb Acolyte', 'Lantern Guardian', 'Moon Sage'] },
};
/** Art version folder/prefix for painted sprites (v2.2.1: per-family sheets, four tiers). */
const ART_V = 'mon3';
export const monsterSrc = (fam, tier) => `hero/${ART_V}-${fam}-${tier}.webp`;
export const GATE_ORDER = ['math', 'sci', 'eng', 'ind', 'pan', 'aga'];
const PREFIX = { M7: 'math', S7: 'sci', E8: 'eng', BI7: 'ind', PP7: 'pan', PAI7: 'aga' };
export const familyOf = (ch) => PREFIX[String(ch?.code || '').split('-')[0]] || 'sci';

export const PHASES = {
  new: { label: 'Unknown', tier: '' },
  minion: { label: 'Minion', tier: 'I' },
  elite: { label: 'Elite', tier: 'II' },
  boss: { label: 'Boss', tier: 'III' },
  sealed: { label: 'Sealed', tier: '✓' },
};
/** Phase from bossState() (dojo.js) + rules. */
export function phaseOf(st, R) {
  if (!st.n) return 'new';
  if (st.beatNow) return 'sealed';
  if (st.status === 'revived') return 'boss';
  if (st.n < R.min) return 'minion';
  if (st.acc < R.revive) return 'elite';
  return 'boss';
}
export const formName = (fam, phase) => { const f = FAMILIES[fam]; return phase === 'minion' ? f.forms[0] : phase === 'elite' ? f.forms[1] : phase === 'exam' ? f.forms[3] : f.forms[2]; };

/* ---------- seeded variation ---------- */
function seedOf(s) { let h = 2166136261; for (const c of String(s)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619); } return h >>> 0; }
function rng(seed) { let a = seed || 1; return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function shade(hex, k) { // k<0 darker, k>0 lighter
  const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = n >> 8 & 255, b = n & 255;
  const f = (v) => Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k);
  return '#' + [f(r), f(g), f(b)].map(v => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('');
}
const INK = '#120F22';
const eye = (x, y, r, col = '#fff', glow) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${glow || '#fff'}" opacity="${glow ? 0.35 : 1}"/><ellipse cx="${x}" cy="${y}" rx="${r * 0.62}" ry="${r * 0.62}" fill="${col}"/><circle cx="${x - r * 0.2}" cy="${y - r * 0.25}" r="${r * 0.22}" fill="#fff"/>`;

/* ---------- family bodies (viewBox 0 0 120 120, ground at y 108) ---------- */
const ART = {
  math(p, ph, r) {
    const ring = ph !== 'minion' ? `<circle cx="60" cy="56" r="${ph === 'boss' ? 44 : 36}" fill="none" stroke="${p.g}" stroke-width="1.6" stroke-dasharray="4 5" opacity=".8"/>` : '';
    const sides = 5 + Math.floor(r() * 3), R = ph === 'boss' ? 34 : ph === 'elite' ? 30 : 26;
    let poly = ''; for (let i = 0; i < sides; i++) { const t = -Math.PI / 2 + i * 2 * Math.PI / sides; poly += `${(60 + Math.cos(t) * R).toFixed(1)},${(58 + Math.sin(t) * R).toFixed(1)} `; }
    const orbit = (ph === 'minion' ? 2 : ph === 'elite' ? 3 : 4);
    let tri = ''; for (let i = 0; i < orbit; i++) { const t = r() * 6.28, d = R + 12 + r() * 6, x = 60 + Math.cos(t) * d, y = 58 + Math.sin(t) * d * 0.8; tri += `<path d="M${x.toFixed(1)} ${(y - 6).toFixed(1)} l6 10 l-12 0 Z" fill="${p.g}" stroke="${INK}" stroke-width="1.5"/>`; }
    const crown = ph === 'boss' ? `<path d="M42 26 L50 12 L60 22 L70 12 L78 26 Z" fill="${p.g}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>` : '';
    const runes = `<path d="M${60 - R * 0.5} ${58 + R * 0.45} h${R} M${60 - R * 0.3} ${58 + R * 0.62} h${R * 0.6}" stroke="${p.g}" stroke-width="2" stroke-linecap="round" opacity=".9"/>`;
    return `${ring}<polygon points="${poly}" fill="url(#mg)" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>${runes}${eye(60, 54, ph === 'minion' ? 10 : 12, p.d, p.g)}${tri}${crown}`;
  },
  sci(p, ph, r) {
    const n = ph === 'minion' ? 3 : ph === 'elite' ? 5 : 7;
    let shards = ''; for (let i = 0; i < n; i++) { const a = -2.6 + i * (2.2 / Math.max(1, n - 1)) + (r() - 0.5) * 0.2, L = 32 + r() * 16 + (ph === 'boss' ? 8 : 0), x = 60 + Math.cos(a) * 10, y = 66 + Math.sin(a) * 8; const tx = 60 + Math.cos(a) * L, ty = 66 + Math.sin(a) * L; shards += `<path d="M${x - 6} ${y} L${tx.toFixed(1)} ${ty.toFixed(1)} L${x + 6} ${y} Z" fill="${i % 2 ? p.c : shade(p.c, 0.25)}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>`; }
    const arcs = ph !== 'minion' ? `<path d="M26 60 l8 -6 l-2 8 l8 -5 M94 60 l-8 -6 l2 8 l-8 -5" stroke="${p.g}" stroke-width="2" fill="none" stroke-linecap="round"/>` : '';
    const atoms = ph === 'boss' ? `<ellipse cx="60" cy="72" rx="40" ry="12" fill="none" stroke="${p.g}" stroke-width="1.5" opacity=".8" transform="rotate(-18 60 72)"/><circle cx="96" cy="62" r="3" fill="${p.g}"/>` : '';
    return `${shards}${atoms}<circle cx="60" cy="72" r="${ph === 'minion' ? 19 : 23}" fill="url(#mg)" stroke="${INK}" stroke-width="2.6"/>${eye(53, 71, 4.6, p.d)}${eye(67, 71, 4.6, p.d)}${arcs}`;
  },
  eng(p, ph, r) {
    const s = ph === 'boss' ? 1.15 : ph === 'elite' ? 1.0 : 0.85;
    const w = 30 * s, top = 24 + (1 - s) * 30;
    const body = `<path d="M${60 - w} 92 C${60 - w} 60 ${60 - w * 0.7} ${top} 60 ${top} C${60 + w * 0.7} ${top} ${60 + w} 60 ${60 + w} 92 L${60 + w * 0.6} 84 L${60 + w * 0.2} 96 L${60 - w * 0.2} 84 L${60 - w * 0.6} 96 Z" fill="url(#mg)" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>`;
    const horns = `<path d="M${60 - w * 0.5} ${top + 10} C${60 - w * 0.9} ${top - 8} ${60 - w * 1.1} ${top - 14} ${60 - w * 1.2} ${top - 20} C${60 - w * 0.7} ${top - 12} ${60 - w * 0.5} ${top - 4} ${60 - w * 0.3} ${top + 6} Z M${60 + w * 0.5} ${top + 10} C${60 + w * 0.9} ${top - 8} ${60 + w * 1.1} ${top - 14} ${60 + w * 1.2} ${top - 20} C${60 + w * 0.7} ${top - 12} ${60 + w * 0.5} ${top - 4} ${60 + w * 0.3} ${top + 6} Z" fill="${p.g}" stroke="${INK}" stroke-width="2"/>`;
    const letters = ph !== 'minion' ? `<text x="${18 + r() * 6}" y="44" font-family="Georgia,serif" font-size="14" font-weight="700" fill="${p.g}">A</text><text x="${92 + r() * 4}" y="${50 + r() * 8}" font-family="Georgia,serif" font-size="13" font-weight="700" fill="${p.g}">?</text>` : '';
    const drips = ph === 'boss' ? `<path d="M40 96 q2 8 0 10 M80 96 q2 8 0 10" stroke="${p.d}" stroke-width="4" stroke-linecap="round"/>` : '';
    return `${horns}${body}${drips}<path d="M${60 - 14 * s} ${60} l10 -4 M${60 + 14 * s} 60 l-10 -4" stroke="${INK}" stroke-width="2.4" stroke-linecap="round"/>${eye(60 - 9 * s, 66, 5 * s, p.d)}${eye(60 + 9 * s, 66, 5 * s, p.d)}<path d="M${60 - 7 * s} 80 q7 5 14 0" stroke="${INK}" stroke-width="2" fill="none"/>${letters}`;
  },
  ind(p, ph, r) {
    const s = ph === 'boss' ? 1.15 : ph === 'elite' ? 1 : 0.86;
    const kite = `<path d="M60 ${18 + (1 - s) * 30} L${60 + 30 * s} 56 L60 ${88 + (s - 1) * 10} L${60 - 30 * s} 56 Z" fill="url(#mg)" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>`;
    const band = `<path d="M${60 - 22 * s} 52 L${60 + 22 * s} 52 L${60 + 18 * s} 62 L${60 - 18 * s} 62 Z" fill="${p.d}" stroke="${INK}" stroke-width="1.8"/>${[0, 1, 2, 3].map(i => `<circle cx="${60 - 12 * s + i * 8 * s}" cy="57" r="1.6" fill="${p.g}"/>`).join('')}`;
    const tail = `<path d="M60 ${88 + (s - 1) * 10} C56 96 66 100 60 108" stroke="${p.d}" stroke-width="3" fill="none"/><path d="M55 100 l10 0 M56 106 l8 0" stroke="${p.g}" stroke-width="3" stroke-linecap="round"/>`;
    const ribbons = ph !== 'minion' ? `<path d="M${60 - 30 * s} 56 C${30 - 6 * s} 70 ${22} 64 ${16} 80 M${60 + 30 * s} 56 C${90 + 6 * s} 70 98 64 104 80" stroke="${p.c}" stroke-width="4" fill="none" stroke-linecap="round"/>` : '';
    const crown = ph === 'boss' ? `<path d="M48 22 L52 10 L60 18 L68 10 L72 22" fill="${p.g}" stroke="${INK}" stroke-width="2" stroke-linejoin="round"/>` : '';
    return `${ribbons}${tail}${kite}${band}${eye(60 - 9 * s, 44, 4.4 * s, p.d)}${eye(60 + 9 * s, 44, 4.4 * s, p.d)}<path d="M54 72 q6 4 12 0" stroke="${INK}" stroke-width="2" fill="none"/>${crown}`;
  },
  pan(p, ph, r) {
    const s = ph === 'boss' ? 1.12 : ph === 'elite' ? 1 : 0.86;
    const shield = `<path d="M${60 - 26 * s} ${34} L${60 + 26 * s} 34 L${60 + 24 * s} 70 C${60 + 18 * s} 88 ${60 + 6 * s} 96 60 100 C${60 - 6 * s} 96 ${60 - 18 * s} 88 ${60 - 24 * s} 70 Z" fill="url(#mg)" stroke="${INK}" stroke-width="2.6" stroke-linejoin="round"/>`;
    const helm = `<path d="M${60 - 20 * s} 36 C${60 - 20 * s} 18 ${60 + 20 * s} 18 ${60 + 20 * s} 36 Z" fill="${p.d}" stroke="${INK}" stroke-width="2.4"/><rect x="${60 - 16 * s}" y="40" width="${32 * s}" height="8" rx="3" fill="${INK}"/><circle cx="${60 - 7 * s}" cy="44" r="2.6" fill="${p.g}"/><circle cx="${60 + 7 * s}" cy="44" r="2.6" fill="${p.g}"/>`;
    const star = `<path d="M60 58 l3 8 l8 0 l-6 5 l2 8 l-7 -5 l-7 5 l2 -8 l-6 -5 l8 0 Z" fill="${p.g}" stroke="${INK}" stroke-width="1.5"/>`;
    const pads = ph !== 'minion' ? `<path d="M${60 - 26 * s} 36 C${60 - 40 * s} 34 ${60 - 42 * s} 50 ${60 - 32 * s} 54 L${60 - 25 * s} 48 Z M${60 + 26 * s} 36 C${60 + 40 * s} 34 ${60 + 42 * s} 50 ${60 + 32 * s} 54 L${60 + 25 * s} 48 Z" fill="${shade(p.c, -0.2)}" stroke="${INK}" stroke-width="2"/>` : '';
    const spear = ph === 'boss' ? `<path d="M100 104 L100 24" stroke="${p.d}" stroke-width="4"/><path d="M100 12 l6 14 l-12 0 Z" fill="${p.g}" stroke="${INK}" stroke-width="1.8"/><path d="M100 28 L84 34 L100 40" fill="${p.c}" stroke="${INK}" stroke-width="1.5"/>` : '';
    const plume = ph === 'boss' ? `<path d="M60 18 C70 4 82 8 86 14 C76 12 68 16 62 24 Z" fill="${p.c}" stroke="${INK}" stroke-width="1.8"/>` : '';
    return `${spear}${pads}${shield}${helm}${plume}${star}`;
  },
  aga(p, ph, r) {
    const s = ph === 'boss' ? 1.12 : ph === 'elite' ? 1 : 0.86;
    const wisp = `<path d="M${60 - 22 * s} 66 C${60 - 24 * s} 86 ${60 - 10 * s} 100 60 104 C${60 + 10 * s} 98 ${60 + 4 * s} 90 ${60 + 14 * s} 86 C${60 + 24 * s} 80 ${60 + 22 * s} 70 ${60 + 22 * s} 66 Z" fill="${shade(p.c, -0.25)}" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round" opacity=".95"/>`;
    const mirror = `<ellipse cx="60" cy="50" rx="${24 * s}" ry="${28 * s}" fill="${p.d}" stroke="${INK}" stroke-width="2.6"/><ellipse cx="60" cy="50" rx="${19 * s}" ry="${23 * s}" fill="url(#mg)"/><path d="M${60 - 12 * s} ${36} l8 -6 M${60 - 14 * s} 44 l14 -10" stroke="#fff" stroke-width="2.4" stroke-linecap="round" opacity=".7"/>`;
    const eyes = ph === 'minion' ? `<path d="M50 54 q4 3 8 0 M62 54 q4 3 8 0" stroke="${INK}" stroke-width="2.4" fill="none" stroke-linecap="round"/>` : `${eye(52, 54, 4.2, p.d)}${eye(68, 54, 4.2, p.d)}`;
    const floaters = ph !== 'minion' ? `<ellipse cx="22" cy="44" rx="6" ry="8" fill="${p.g}" stroke="${INK}" stroke-width="1.6"/><ellipse cx="98" cy="40" rx="6" ry="8" fill="${p.g}" stroke="${INK}" stroke-width="1.6"/>` : '';
    const halo = ph === 'boss' ? `<g stroke="${p.g}" stroke-width="2.2" stroke-linecap="round">${[0, 1, 2, 3, 4, 5, 6, 7].map(i => { const a = i * Math.PI / 4; return `<path d="M${(60 + Math.cos(a) * 36).toFixed(1)} ${(50 + Math.sin(a) * 40).toFixed(1)} L${(60 + Math.cos(a) * 44).toFixed(1)} ${(50 + Math.sin(a) * 48).toFixed(1)}"/>`; }).join('')}</g>` : '';
    return `${halo}${floaters}${wisp}${mirror}${eyes}`;
  },
};

const SEAL = `<g transform="rotate(-16 60 58)"><rect x="50" y="16" width="20" height="84" rx="2" fill="#FFF4D2" stroke="${INK}" stroke-width="2"/><path d="M55 26h10M55 34h10M60 42v34M55 52h10M54 66l12 6M55 84h10" stroke="#E8473C" stroke-width="2.2" stroke-linecap="round"/></g>`;

const SEAL_OVERLAY = `<svg class="seal-ov" viewBox="0 0 120 120" aria-hidden="true"><g transform="rotate(-16 60 58)"><rect x="50" y="16" width="20" height="84" rx="2" fill="#FFF4D2" stroke="${INK}" stroke-width="2"/><path d="M55 26h10M55 34h10M60 42v34M55 52h10M54 66l12 6M55 84h10" stroke="#E8473C" stroke-width="2.2" stroke-linecap="round"/></g></svg>`;
/** Painted monster portrait (v2.2.0, sheet 3). phase: new | minion | elite | boss | sealed. Idle float is CSS (seeded delay). */
export function monsterSVG(ch, { phase = 'boss', size = 96, angry = false } = {}) {
  const fam = familyOf(ch), r = rng(seedOf('mon:' + ch.code));
  const hue = Math.round((r() - 0.5) * 20), delay = -(r() * 3).toFixed(2), form = phase === 'minion' ? 'minion' : phase === 'elite' ? 'elite' : 'boss';
  return `<span class="mon-wrap mon-${phase}${angry ? ' angry' : ''}" style="width:${size}px;height:${size}px;--md:${delay}s"><img src="${monsterSrc(fam, form)}" alt="" width="${size}" height="${size}" style="filter:hue-rotate(${hue}deg)" decoding="async">${phase === 'new' ? '<b class="mon-q">?</b>' : ''}${phase === 'sealed' ? SEAL_OVERLAY : ''}${angry && phase !== 'sealed' ? '<b class="mon-angry" title="Angry: you retreated from it">😠</b>' : ''}</span>`;
}
/** Exam Boss of a family (gate guardian). */
export function examBoss(fam, { size = 150, locked = false, belt = '' } = {}) {
  return `<span class="mon-wrap mon-exam${locked ? ' locked' : ''}" style="width:${size}px;height:${size}px${belt ? `;--belt:${belt}` : ''}"><img src="${monsterSrc(fam, 'exam')}" alt="" width="${size}" height="${size}" decoding="async">${locked ? '<svg class="lock-ov" viewBox="0 0 40 40" aria-hidden="true"><rect x="9" y="17" width="22" height="17" rx="3" fill="#CFC7EA" stroke="#120F22" stroke-width="2"/><path d="M13 17v-5a7 7 0 0 1 14 0v5" fill="none" stroke="#CFC7EA" stroke-width="3"/></svg>' : ''}</span>`;
}
/** Vector fallback kept for reference / offline art. */
export function monsterVector(ch, { phase = 'boss', size = 96, uid = '' } = {}) {
  const fam = familyOf(ch), base = FAMILIES[fam];
  const r = rng(seedOf('mon:' + ch.code));
  const hueK = (r() - 0.5) * 0.3, hue = Math.round((r() - 0.5) * 70), tilt = ((r() - 0.5) * 8).toFixed(1), sc = (0.92 + r() * 0.14).toFixed(3);
  const p = { c: shade(base.c, hueK), d: base.d, g: base.g };
  const id = 'mg' + (uid || seedOf(ch.code + phase + size).toString(36));
  const art = ART[fam](p, phase === 'sealed' || phase === 'new' ? 'boss' : phase, r).replace(/url\(#mg\)/g, `url(#${id})`);
  const sil = phase === 'new';
  return `<svg class="mon mon-${phase}" viewBox="0 0 120 120" width="${size}" height="${size}" aria-hidden="true">
    <defs><filter id="${id}h"><feColorMatrix type="hueRotate" values="${hue}"/></filter><radialGradient id="${id}" cx=".38" cy=".3" r=".8"><stop offset="0" stop-color="${shade(p.c, 0.35)}"/><stop offset=".55" stop-color="${p.c}"/><stop offset="1" stop-color="${p.d}"/></radialGradient></defs>
    <ellipse cx="60" cy="110" rx="30" ry="5" fill="#000" opacity=".35"/>
    <g ${sil ? 'style="filter:brightness(0)" opacity=".55"' : phase === 'sealed' ? 'style="filter:saturate(.25) brightness(.85)"' : ''}><g filter="url(#${id}h)" transform="translate(60 108) rotate(${tilt}) scale(${sc}) translate(-60 -108)">${art}</g></g>
    ${sil ? '<text x="60" y="66" text-anchor="middle" font-family="Lilita One,Arial Black,sans-serif" font-size="28" fill="#CFC7EA">?</text>' : ''}
    ${phase === 'sealed' ? SEAL : ''}
  </svg>`;
}

/** Exam Gate Boss: a gate guardian in the colour of the belt it guards. */
export function gateSVG(color, { size = 140, locked = false } = {}) {
  const id = 'gt' + color.replace('#', '');
  return `<svg class="gate" viewBox="0 0 160 140" width="${size}" height="${size * 140 / 160}" aria-hidden="true">
    <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FF5A3C"/><stop offset="1" stop-color="#9C1E14"/></linearGradient>
      <radialGradient id="${id}m" cx=".5" cy=".4" r=".7"><stop offset="0" stop-color="#fff"/><stop offset=".5" stop-color="${color}"/><stop offset="1" stop-color="#120F22"/></radialGradient></defs>
    <ellipse cx="80" cy="132" rx="62" ry="6" fill="#000" opacity=".4"/>
    <path d="M14 22 C50 30 110 30 146 22 L142 36 C106 42 54 42 18 36 Z" fill="url(#${id})" stroke="${INK}" stroke-width="2.4"/>
    <rect x="26" y="46" width="108" height="9" rx="2" fill="url(#${id})" stroke="${INK}" stroke-width="2"/>
    <rect x="34" y="36" width="12" height="96" fill="url(#${id})" stroke="${INK}" stroke-width="2.4"/><rect x="114" y="36" width="12" height="96" fill="url(#${id})" stroke="${INK}" stroke-width="2.4"/>
    <g ${locked ? 'opacity=".5"' : ''}>
      <circle cx="80" cy="92" r="30" fill="url(#${id}m)" opacity=".55"/>
      <path d="M60 74 C60 62 100 62 100 74 L98 100 C92 112 68 112 62 100 Z" fill="#F4F1EA" stroke="${INK}" stroke-width="2.4"/>
      <path d="M62 70 L54 56 L68 66 Z M98 70 L106 56 L92 66 Z" fill="${color}" stroke="${INK}" stroke-width="2"/>
      <path d="M67 84 l10 4 M93 84 l-10 4" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>
      <circle cx="72" cy="90" r="3" fill="#E8473C"/><circle cx="88" cy="90" r="3" fill="#E8473C"/>
      <path d="M70 102 q10 6 20 0" stroke="${INK}" stroke-width="2.4" fill="none"/>
      <rect x="66" y="112" width="28" height="6" rx="2" fill="${color}" stroke="${INK}" stroke-width="1.6"/>
    </g>
    ${locked ? `<g transform="translate(80 92)"><rect x="-11" y="-6" width="22" height="18" rx="3" fill="#CFC7EA" stroke="${INK}" stroke-width="2"/><path d="M-7 -6 v-6 a7 7 0 0 1 14 0 v6" fill="none" stroke="#CFC7EA" stroke-width="3"/></g>` : ''}
  </svg>`;
}

/** Family emblem (small round badge). */
export const familyPortrait = (fam, size = 64) => `<img class="fam-pic" src="${monsterSrc(fam, 'exam')}" width="${size}" height="${size}" alt="" decoding="async">`;
export function familyEmblem(fam, size = 40) {
  const f = FAMILIES[fam];
  const glyph = { math: 'M14 26 L20 12 L26 26 Z M12 22 h16', sci: 'M20 10 L26 20 L20 30 L14 20 Z', eng: 'M14 28 C18 18 24 12 28 10 C24 16 22 22 20 30 Z', ind: 'M20 10 L28 20 L20 30 L12 20 Z M20 30 v6', pan: 'M12 12 h16 v10 c0 6 -4 9 -8 11 c-4 -2 -8 -5 -8 -11 Z', aga: 'M20 10 a8 10 0 1 0 0.1 0 Z' }[fam];
  return `<svg viewBox="0 0 40 40" width="${size}" height="${size}" aria-hidden="true"><circle cx="20" cy="20" r="18" fill="${f.d}" stroke="${f.c}" stroke-width="2.5"/><path d="${glyph}" fill="${f.g}" stroke="${f.g}" stroke-width="1.5" stroke-linejoin="round"/></svg>`;
}
