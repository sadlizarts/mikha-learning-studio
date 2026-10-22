// Retreat rules (v2.5.0, Sadli 22 Oct 2026): leaving a practice that has answers costs XP on an escalating daily scale.
// The server applies the cost (abandon_attempt / abandon_stale_attempts); this module only explains it before Mikha decides.
import { esc, sheet, toast } from './ui.js';
import { retreatPreview, abandonAttempt } from './store.js';
import { RANKS } from './dojo.js';

export const retreatCost = (n) => (n <= 1 ? 25 : n === 2 ? 50 : n === 3 ? 100 : n === 4 ? 200 : 400);

function costHtml(pv) {
  const drop = pv.rank_after < pv.rank_before ? RANKS[pv.rank_after] : null;
  return `<p><b>Retreat #${pv.nth} today: −${pv.xp_lost} XP</b>${pv.xp_lost < pv.xp_cost ? ` (you only have ${pv.xp_lost} XP)` : ''}.</p>
    ${drop ? `<p style="color:#FF9A9A"><b>⚠️ Your belt drops to ${esc(drop.belt)} (${esc(drop.name)}).</b> You would need to pass the exam again.</p>` : ''}
    <p>The monster gets angry 😠, and the questions you got wrong come back first next time.</p>
    <p class="note">The next Retreat today costs ${retreatCost(pv.nth + 1)} XP. The count resets at midnight.</p>`;
}

/** Ask before abandoning `ip` (an in-progress attempt). Returns true when it was abandoned. */
export async function confirmRetreat(ip, { keepLabel = 'Keep fighting' } = {}) {
  if (!ip) return false;
  let pv = null;
  if ((ip.answered_count || 0) > 0) { try { pv = await retreatPreview(); } catch { /* fall back to a plain warning */ } }
  const body = (ip.answered_count || 0) === 0 ? '<p>You haven\'t answered anything yet, so leaving is free.</p>'
    : pv ? costHtml(pv) : '<p>Leaving after answering counts as a Retreat and costs XP.</p>';
  const ok = await sheet({ title: (ip.answered_count || 0) ? 'Retreat from this battle?' : 'Start fresh?', body,
    actions: [{ label: keepLabel, value: false, cls: 'primary' }, { label: pv ? `Retreat −${pv.xp_lost} XP` : 'Leave it', value: true, cls: 'danger' }] });
  if (!ok) return false;
  await abandonAttempt(ip.id);
  if (pv && pv.xp_lost) toast(`Retreat: −${pv.xp_lost} XP`, 3000);
  return true;
}

/** One line for the Leave sheet in the quiz: what happens if the practice is left for 24 hours. */
export async function staleWarning(answered) {
  if (!answered) return '';
  try { const pv = await retreatPreview(); return ` If you don't come back within 24 hours it counts as a Retreat (−${pv.xp_lost} XP).`; }
  catch { return " If you don't come back within 24 hours it counts as a Retreat and costs XP."; }
}
