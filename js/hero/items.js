// Hero progression (v1.9.0): everything is derived from existing progress (XP level, sealed bosses, cards, rank).
// The hero has no XP of its own and items never get lost.
import { levelInfo } from '../ui.js';
import { cardTier } from '../dojo.js';

export const RARITY = {
  bronze: { name: 'Bronze', color: '#C47A3A', n: 1 },
  silver: { name: 'Silver', color: '#B8C2D0', n: 2 },
  gold: { name: 'Gold', color: '#F5C400', n: 3 },
  epic: { name: 'Epic', color: '#8B5CF6', n: 4 },
  legendary: { name: 'Legendary', color: '#FF6A2E', n: 5 },
};
export const SLOTS = [
  { key: 'weapon', name: 'Weapon', level: 1 },
  { key: 'accessory', name: 'Accessory', level: 2 },
  { key: 'armor', name: 'Armor', level: 4 },
  { key: 'aura', name: 'Aura', level: 6 },
];
export const AURAS = {
  'u-spirit': { color: 0x6FB7FF, name: 'Spirit Mist' },
  'u-jade': { color: 0x3FE0A0, name: 'Jade Wind' },
  'u-violet': { color: 0xA77BFF, name: 'Violet Seal' },
  'u-ember': { color: 0xFF7A3D, name: 'Ember Crown' },
  'u-sun': { color: 0xFFD233, name: 'Dawn Sun' },
  // v3.1 chest auras (same keys/colours as public.cosmetic_items)
  'u-c-neon': { color: 0x22E5FF, name: 'Neon Cyan', chest: 'common' },
  'u-c-rose': { color: 0xFF7EB6, name: 'Rose Quartz', chest: 'common' },
  'u-c-mint': { color: 0x7DFFB2, name: 'Mint Breeze', chest: 'common' },
  'u-c-bloodmoon': { color: 0xE0303A, name: 'Blood Moon', chest: 'rare' },
  'u-c-storm': { color: 0x5B6CFF, name: 'Storm Indigo', chest: 'rare' },
  'u-c-gold': { color: 0xFFC83D, name: 'Royal Gold', chest: 'rare' },
  'u-c-void': { color: 0x9B30FF, name: 'Void Flame', chest: 'epic' },
  'u-c-aurora': { color: 0x00FFC6, name: 'Aurora Spirit', chest: 'epic' },
  // v3.4 legendary auras (Survival Tower): the colour keeps shifting on the stage
  'u-l-phoenix': { color: 0xFF6A2E, name: 'Phoenix Flame', chest: 'legendary', cycle: [0xFF3D2E, 0xFF8A2E, 0xFFD25A, 0xFF5A7A] },
  'u-l-galaxy': { color: 0x7A5CFF, name: 'Galaxy Spirit', chest: 'legendary', cycle: [0x4B3DFF, 0x9B5CFF, 0x22E5FF, 0xFF7EB6] },
};
export const CHEST_RARITY = { common: 'silver', rare: 'gold', epic: 'epic', legendary: 'legendary' };
const SUBJ_NAME = { math: 'Math', sci: 'Science', eng: 'English', ind: 'B. Indonesia', pan: 'Pancasila', aga: 'Agama' };
/** v3.4 legendary subject weapons, owned through public.cosmetic_items (kind 'weapon') */
export const LEGEND_WEAPONS = {
  'w-l-infinity-compass': { name: 'Infinity Compass', subject: 'math' },
  'w-l-quantum-prism': { name: 'Quantum Prism', subject: 'sci' },
  'w-l-storyforge-quill': { name: 'Storyforge Quill', subject: 'eng' },
  'w-l-aksara-agung': { name: 'Aksara Agung', subject: 'ind' },
  'w-l-perisai-lima-sila': { name: 'Perisai Lima Sila', subject: 'pan' },
  'w-l-lentera-fajar': { name: 'Lentera Fajar', subject: 'aga' },
};

// subject key -> item that grows with sealed bosses of that subject
const SUBJECT_ITEM = {
  math: { key: 'w-compass-blade', slot: 'weapon', name: 'Compass Blade' },
  sci: { key: 'w-prism-staff', slot: 'weapon', name: 'Prism Staff' },
  eng: { key: 'w-quill-lance', slot: 'weapon', name: 'Quill Lance' },
  ind: { key: 'a-aksara-scarf', slot: 'accessory', name: 'Aksara Scarf' },
  pan: { key: 'r-unity-guard', slot: 'armor', name: 'Unity Guard' },
  aga: { key: 'a-dawn-lantern', slot: 'accessory', name: 'Dawn Lantern' },
};

/** Static catalog; `rule(ctx)` returns { owned, rarity, hint }. */
export function catalog() {
  const lvl = (L, rarity) => (c) => ({ owned: c.level >= L, rarity, hint: `Reach Level ${L}` });
  const bossN = (n, rarity) => (c) => ({ owned: c.sealedEver >= n, rarity, hint: `Seal ${n} bosses` });
  const rankN = (r, rarity, nm) => (c) => ({ owned: c.rank >= r, rarity, hint: `Become ${nm}` });
  const list = [
    { key: 'w-bokken', slot: 'weapon', name: 'Training Bokken', rule: lvl(1, 'bronze') },
    { key: 'a-headband', slot: 'accessory', name: 'Focus Headband', rule: lvl(2, 'bronze') },
    { key: 'r-shoulder', slot: 'armor', name: 'Steel Pauldrons', rule: lvl(4, 'bronze') },
    { key: 'w-ember-staff', slot: 'weapon', name: 'Ember Staff', rule: lvl(5, 'silver') },
    { key: 'u-spirit', slot: 'aura', name: AURAS['u-spirit'].name, rule: lvl(6, 'bronze') },
    { key: 'r-gauntlets', slot: 'armor', name: 'Iron Gauntlets', rule: lvl(7, 'silver') },
    { key: 'a-amulet', slot: 'accessory', name: 'Sky Amulet', rule: lvl(8, 'silver') },
    { key: 'u-jade', slot: 'aura', name: AURAS['u-jade'].name, rule: bossN(10, 'silver') },
    { key: 'r-sealbreaker', slot: 'armor', name: 'Sealbreaker Plate', rule: (c) => ({ owned: c.examsPassed >= 1, rarity: 'epic', hint: 'Pass a rank exam' }) },
    { key: 'u-violet', slot: 'aura', name: AURAS['u-violet'].name, rule: rankN(3, 'gold', 'Seeker') },
    { key: 'u-ember', slot: 'aura', name: AURAS['u-ember'].name, rule: rankN(5, 'epic', 'Elite') },
    { key: 'u-sun', slot: 'aura', name: AURAS['u-sun'].name, rule: rankN(7, 'legendary', 'Legendary') },
    { key: 'w-grand-katana', slot: 'weapon', name: 'Legendary Katana', rule: rankN(7, 'legendary', 'Legendary') },
  ];
  for (const [key, a] of Object.entries(AURAS)) if (a.chest)
    list.push({ key, slot: 'aura', name: a.name, chest: true, rule: (c) => ({ owned: !!c.cosmetics?.has(key), rarity: CHEST_RARITY[a.chest], hint: a.chest === 'legendary' ? 'Any Tower, floor 40+' : 'Found in round chests' }) });
  for (const [key, w] of Object.entries(LEGEND_WEAPONS))
    list.push({ key, slot: 'weapon', name: w.name, subject: w.subject, legend: true, rule: (c) => ({ owned: !!c.cosmetics?.has(key), rarity: 'legendary', hint: `${SUBJ_NAME[w.subject]} Tower, floor 40+` }) });
  for (const [sub, it] of Object.entries(SUBJECT_ITEM)) {
    list.push({ ...it, subject: sub, rule: (c) => {
      const s = c.bySubject[sub] || { sealed: 0, total: 0 };
      const rarity = s.total && s.sealed >= s.total ? 'epic' : s.sealed >= 4 ? 'gold' : 'silver';
      return { owned: s.sealed >= 2, rarity, hint: `Seal 2 ${c.subjectName[sub] || ''} bosses`.replace(/\s+/g, ' ') };
    } });
  }
  return list;
}

/** Context from dojoData() (features/dojo.js) + exams. */
export function heroContext(d) {
  const lv = levelInfo(d.prog?.xp_total || 0);
  const bySubject = {}, subjectName = {};
  for (const b of d.bosses) {
    const k = b.m.key; subjectName[k] = b.m.short;
    const s = bySubject[k] ||= { sealed: 0, total: 0, cards: [] };
    s.total++; if (b.beaten) { s.sealed++; s.cards.push(b); }
  }
  const sealedEver = d.bosses.filter(b => b.beaten).length;
  const examsPassed = (d.dj.exams || []).filter(e => e.passed).length;
  return { level: lv.level, lv, rank: d.rk.rank, sealedEver, examsPassed, bySubject, subjectName, xp: d.prog?.xp_total || 0 };
}

export function inventory(ctx) {
  return catalog().map(it => ({ ...it, ...it.rule(ctx) })).sort((a, b) => (b.owned - a.owned) || (RARITY[b.rarity].n - RARITY[a.rarity].n));
}

export const slotOpen = (ctx, slot) => ctx.level >= (SLOTS.find(s => s.key === slot)?.level || 1);

/** Keep only items the hero owns and whose slot is open; fill empty weapon with the best owned one. */
export function validEquip(equipped, inv, ctx) {
  const own = new Set(inv.filter(i => i.owned).map(i => i.key));
  const out = {};
  for (const s of SLOTS) {
    const k = equipped?.[s.key];
    if (k && own.has(k) && slotOpen(ctx, s.key) && inv.find(i => i.key === k)?.slot === s.key) out[s.key] = k;
  }
  if (!out.weapon) { const w = inv.find(i => i.owned && i.slot === 'weapon'); if (w) out.weapon = w.key; }
  return out;
}

/** Cosmetic stats. */
export function stats(d, ctx) {
  const power = d.bosses.filter(b => b.beaten).reduce((t, b) => t + ({ bronze: 1, silver: 2, gold: 3 }[cardTier(b.beaten.best_accuracy)]), 0);
  const seen = d.bosses.filter(b => b.st.n);
  const focus = seen.length ? Math.round(seen.reduce((t, b) => t + b.st.acc, 0) / seen.length) : 0;
  return { power, focus, spirit: d.prog?.best_streak || 0 };
}

/** Skill tree: one branch per subject; nodes = chapters, lit by technique cards; milestones at 3 and 6 cards. */
export const BRANCH_TITLES = {
  math: ['Number Adept', 'Number Sage'], sci: ['Element Adept', 'Element Sage'], eng: ['Word Adept', 'Word Sage'],
  ind: ['Kata Adept', 'Kata Sage'], pan: ['Unity Adept', 'Unity Sage'], aga: ['Dawn Adept', 'Dawn Sage'],
};

/** Crop box (rig units) for an item's icon. */
export const ITEM_VIEW = {
  'a-headband': '330 270 500 230', 'a-amulet': '430 590 170 180', 'a-aksara-scarf': '380 560 290 290', 'a-dawn-lantern': '310 920 150 180',
  // weapons (v3.4): fitted to each rotated icon; long staffs/lances crop to their head so the art reads big
  'w-bokken': '539 388 564 564', 'w-ember-staff': '428 262 527 527', 'w-compass-blade': '479 323 628 628', 'w-prism-staff': '416 256 536 536', 'w-quill-lance': '383 183 602 602', 'w-grand-katana': '447 274 698 698', 'w-l-infinity-compass': '351 171 852 852', 'w-l-quantum-prism': '283 125 669 669', 'w-l-storyforge-quill': '283 94 694 694', 'w-l-aksara-agung': '404 224 777 777', 'w-l-perisai-lima-sila': '498 436 596 596', 'w-l-lentera-fajar': '319 172 626 626',
  'r-shoulder': '300 570 430 180', 'r-gauntlets': '270 780 510 130', 'r-unity-guard': '290 580 170 170', 'r-sealbreaker': '390 630 250 290',
};
export const itemView = (key) => ITEM_VIEW[key] || (key.startsWith('w-') ? '330 260 760 760' : '0 0 1024 1536');
