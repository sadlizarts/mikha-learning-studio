// v3.4.0 item info: every item gets a story line, a Power number and its Survival Tower effect,
// so Mikha can compare two items at a glance. Effects only work inside the Tower (never in normal battles).
// The same table lives in SQL (public.item_effect) so the server enforces it; keep both in sync.

/** Power by rarity (+ a small fixed offset per item so equal rarities still differ a little). */
const BASE = { bronze: 15, silver: 30, gold: 48, epic: 68, legendary: 92 };
const offset = (key) => { let h = 0; for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return h % 5; };
export const powerOf = (it) => (BASE[it.rarity] || 0) + offset(it.key);

const SUBJ = { math: 'Math', sci: 'Science', eng: 'English', ind: 'B. Indonesia', pan: 'Pancasila', aga: 'Agama' };

export const DESC = {
  'w-bokken': 'A wooden practice sword. Every master started with one.',
  'w-ember-staff': 'A staff with a small fire that never goes out while you keep trying.',
  'w-compass-blade': 'A blade drawn with perfect angles. Sharpens with every Math boss you seal.',
  'w-prism-staff': 'A crystal staff that bends light into answers. Grows with Science seals.',
  'w-quill-lance': 'A lance tipped with a giant quill. Grows with English seals.',
  'w-grand-katana': 'The katana of a true Legend. Only the final belt unlocks it.',
  'w-l-infinity-compass': 'A compass that draws circles with no end. Forged at the top of the Math tower.',
  'w-l-quantum-prism': 'A prism that splits every problem into its parts. Forged at the top of the Science tower.',
  'w-l-storyforge-quill': 'A quill that writes stories into armour. Forged at the top of the English tower.',
  'w-l-aksara-agung': 'A wavy blade carved with old letters. Forged at the top of the B. Indonesia tower.',
  'w-l-perisai-lima-sila': 'A shield with five points of light, one for each principle. Forged at the top of the Pancasila tower.',
  'w-l-lentera-fajar': 'A dawn lantern on a staff. Its light shows the right path. Forged at the top of the Agama tower.',
  'a-headband': 'A red headband. Tie it on and the noise around you fades.',
  'a-amulet': 'A sky-blue amulet that keeps your mind light.',
  'a-aksara-scarf': 'A scarf woven with letters. Grows with B. Indonesia seals.',
  'a-dawn-lantern': 'A small lantern for the early study hours. Grows with Agama seals.',
  'r-shoulder': 'Steel pauldrons for your first real fights.',
  'r-gauntlets': 'Iron gauntlets. Strong hands, steady answers.',
  'r-unity-guard': 'A round guard with a star at its heart. Grows with Pancasila seals.',
  'r-sealbreaker': 'Plate armour given to those who pass a rank exam.',
  'u-spirit': 'A soft blue mist. Your first aura.',
  'u-jade': 'A green wind that rises after 10 sealed bosses.',
  'u-violet': 'A violet seal of the Seekers.',
  'u-ember': 'An ember crown worn by the Elite.',
  'u-sun': 'The dawn sun of a Legend.',
  'u-c-neon': 'A bright cyan glow from a round chest.',
  'u-c-rose': 'A pink quartz shimmer from a round chest.',
  'u-c-mint': 'A cool mint breeze from a round chest.',
  'u-c-bloodmoon': 'A deep red moonlight. Rare.',
  'u-c-storm': 'An indigo storm that crackles. Rare.',
  'u-c-gold': 'A royal gold light. Rare.',
  'u-c-void': 'A purple flame from the void. Epic.',
  'u-c-aurora': 'Northern lights that follow you. Epic.',
  'u-l-phoenix': 'A flame that rises again and again, always changing colour. Legendary.',
  'u-l-galaxy': 'A whole galaxy turning around you. Legendary.',
};

/**
 * Tower effect from slot + rarity (+ subject for legendary weapons).
 * Returns { focus, cut, guard, lastStand, xp, luck, subject, text }.
 */
export function effectOf(it) {
  const e = { focus: 0, cut: 0, guard: 0, lastStand: 0, xp: 0, luck: 0, subject: null, text: '' };
  const r = it.rarity;
  if (it.slot === 'weapon') {
    if (r === 'legendary' && it.legend) { e.guard = 1; e.cut = 1; e.subject = it.subject; e.text = `+1 Guard +1 Cut (${SUBJ[it.subject] || it.subject} tower) · +1 Cut elsewhere`; }
    else if (r === 'legendary') { e.guard = 1; e.cut = 1; e.text = '+1 Guard +1 Cut (any tower)'; }
    else if (r === 'epic') { e.guard = 1; e.text = '+1 Guard (any tower)'; }
    else if (r === 'gold') { e.cut = 1; e.text = '+1 Cut (any tower)'; }
    else if (r === 'silver') { e.focus = 1; e.text = '+1 Focus (any tower)'; }
    else e.text = 'No Tower bonus (training weapon)';
  } else if (it.slot === 'armor') {
    if (r === 'epic' || r === 'legendary') { e.lastStand = 1; e.text = 'Last Stand: survive your 3rd mistake once per run'; }
    else e.text = 'No Tower bonus (look only)';
  } else if (it.slot === 'accessory') {
    e.xp = { bronze: 5, silver: 10, gold: 15, epic: 20, legendary: 20 }[r] || 0; e.text = `+${e.xp}% Tower XP`;
  } else if (it.slot === 'aura') {
    e.luck = { bronze: 2, silver: 5, gold: 8, epic: 12, legendary: 15 }[r] || 0; e.text = `+${e.luck}% chest luck (Tower)`;
  }
  e.short = e.lastStand ? '❤️ Last Stand' : e.guard && e.cut ? '🛡️ Guard ✂️ Cut' : e.guard ? '🛡️ +1 Guard' : e.cut ? '✂️ +1 Cut' : e.focus ? '🔍 +1 Focus'
    : e.xp ? `⭐ +${e.xp}% XP` : e.luck ? `🍀 +${e.luck}% luck` : '';
  return e;
}

/** Rarity stars for the cards (1 Bronze … 5 Legendary). */
export const STARS = { bronze: 1, silver: 2, gold: 3, epic: 4, legendary: 5 };

/** What the skills do (shown on the item card and in the Tower lobby). */
export const SKILL_HELP = {
  focus: 'Focus: removes 1 wrong answer.',
  insight: 'Insight: shows the hint for this question.',
  cut: 'Cut: removes 2 wrong answers.',
  guard: 'Guard: a wrong answer costs no life.',
  lastStand: 'Last Stand: once per run, the run-ending mistake is forgiven.',
};

/** Hero Power = sum of the equipped items' power. */
export const heroPower = (equipped, inv) => ['weapon', 'accessory', 'armor', 'aura'].reduce((t, s) => {
  const it = inv.find(i => i.key === equipped[s]); return t + (it ? powerOf(it) : 0);
}, 0);
