// Pick chapters (DESIGN §5.3, PRD FR-11..FR-13, FR-20, FR-25a, FR-27).
import { $, $$, esc, subjectMeta, shortCode, sheet, toast } from '../ui.js';
import { startAttempt, inProgressAttempt, abandonAttempt, prefs, loadProgress, intelCharges, startMode, revengeCount } from '../store.js';
import { lessonsMeta } from './learn.js';
import { bossName } from '../dojo.js';
import { app, catalog } from '../state.js';
import { confirmRetreat } from '../retreat.js';
import { monsterSVG, phaseOf } from '../monsters.js';
import { bossState, rules } from '../dojo.js';
import { show, navigate } from '../router.js';
import { loadReports, benchmarks, benchFor, benchBanner } from '../report.js';

let cat = null;
let curSub = null;
const sel = new Set(prefs.get('lastChapters', []));
let len = prefs.get('lastLen', 30);
let busy = false;
let bms = [];
let mode = prefs.get('mode', 'normal'), revN = null;
const MODES = {
  normal: { ic: '⚔️', n: 'Battle', d: '30 questions · 3 rounds of 10 · chests' },
  blitz: { ic: '⚡', n: 'Blitz', d: '60 seconds, as many as you can · 8 XP each · does not change boss accuracy' },
  rage: { ic: '💢', n: 'Rage', d: '15 questions, 3 lives · survive for +30 XP' },
  revenge: { ic: '🔁', n: 'Revenge', d: 'Win back questions you got wrong before · 12 XP each' },
};
function renderModes() {
  if (!MODES[mode]) mode = 'normal';
  $('#modebar').innerHTML = Object.entries(MODES).map(([k, m]) => `<button class="mode ${k === mode ? 'on' : ''}" data-mode="${k}" role="radio" aria-checked="${k === mode}"><span>${m.ic}</span>${m.n}${k === 'revenge' && revN !== null ? ` <i class="num">${revN}</i>` : ''}</button>`).join('');
  const rev = mode === 'revenge';
  $('#subtabs').hidden = rev; $('#chaplist').hidden = rev; $('#benchpick').hidden = rev;
  const ri = $('#revinfo'); ri.hidden = !rev;
  if (rev) ri.innerHTML = `<div class="nd-h2" style="font-size:18px">🔁 Revenge</div><p class="nd-sub" style="margin:4px 0 0">${revN === null ? 'Counting your old mistakes…' : revN >= 5 ? `<b class="num">${revN}</b> questions you got wrong before are waiting. Each battle brings back 10 of them. Get one right and it is avenged for good!` : `Only <b class="num">${revN}</b> mistakes to avenge (you need 5). Nice!`}</p>`;
  document.querySelector('#s-pick .lenbar').hidden = mode !== 'normal';
  $$('#modebar [data-mode]').forEach(b => b.onclick = () => { mode = b.dataset.mode; prefs.set('mode', mode); renderModes(); updateMeta(); });
}

const avail = (c) => c.distinct_items || 0;
function available() {
  return cat.chapters.filter(c => sel.has(c.chapter_id)).reduce((t, c) => t + avail(c), 0);
}

function renderSubtabs() {
  $('#subtabs').innerHTML = cat.subjects.map(s => {
    const m = subjectMeta(s);
    const n = cat.chapters.filter(c => c.subject_id === s.id && sel.has(c.chapter_id)).length;
    const on = s.id === curSub;
    return `<button class="subtab ${on ? 'on' : ''}" style="--c:${m.color}" data-sub="${s.id}" role="tab" aria-selected="${on}">${esc(m.short)}${n ? ` <span class="cnt num">${n}</span>` : ''}</button>`;
  }).join('');
  const cur = cat.subjects.find(x => x.id === curSub);
  $('#benchpick').innerHTML = cur ? benchBanner(benchFor(bms, curSub), subjectMeta(cur).short) : '';
}

function renderChapters() {
  const s = cat.subjects.find(x => x.id === curSub);
  const m = subjectMeta(s);
  const rows = cat.chapters.filter(c => c.subject_id === curSub);
  $('#chaplist').innerHTML = rows.map(c => {
    const n = avail(c), on = sel.has(c.chapter_id), off = n === 0;
    const st = cat.statBy[c.chapter_id];
    const acc = st && st.answered > 0 ? st.accuracy_recent : null;
    const meta = off ? 'No questions yet' : `${n} questions${acc === null ? ' · <span class="new">NEW</span>' : ''}`;
    return `<button class="chap ${on ? 'on' : ''}" style="--c:${m.color}" data-ch="${c.chapter_id}" ${off ? 'disabled' : ''} aria-pressed="${on}">
      <div class="code mcode">${monsterSVG(c, { phase: st ? phaseOf(bossState(st, false, rules(cat)), rules(cat)) : 'new', size: 50 })}<b class="cbadge">${esc(shortCode(c.code))}</b></div>
      <div class="grow"><div class="name">${esc(c.name)}</div><div class="meta num">${meta}</div></div>
      ${acc !== null ? `<div class="acc num ${acc < (+cat.rules?.needs_work_threshold || 70) ? 'bad' : 'ok'}" title="Last 30 answers">${acc}%</div>` : ''}
      <div class="box" aria-hidden="true"></div></button>`;
  }).join('') || '<div class="panel sunk empty">No chapters here yet.</div>';
  updateMeta();
}

function updateMeta() {
  const n = sel.size, t = available();
  $('#picklab').textContent = mode === 'normal' ? 'Session length' : `${MODES[mode].ic} ${MODES[mode].n} mode`;
  if (mode !== 'normal') {
    const b = $('#startbtn'), M = MODES[mode];
    $('#pickwarn').hidden = true;
    $('#pickmeta').textContent = M.d;
    if (mode === 'revenge') { b.disabled = busy || !(revN >= 5); b.textContent = busy ? 'Getting questions…' : revN >= 5 ? `🔁 Start Revenge (${Math.min(10, revN)}) →` : 'Not enough mistakes yet'; return; }
    b.disabled = n === 0 || t < 10 || busy;
    b.textContent = busy ? 'Getting questions…' : n === 0 ? 'Pick at least one chapter' : t < 10 ? 'Not enough questions yet' : mode === 'blitz' ? '⚡ Start Blitz · 60 s →' : '💢 Start Rage · 3 lives →';
    return;
  }
  $('#pickmeta').textContent = `${n} chapter${n === 1 ? '' : 's'} · ${t} questions available`;
  const fifty = $('[data-len="50"]');
  fifty.disabled = n > 0 && t < 50;
  if (fifty.disabled && len === 50) setLen(30);
  const b = $('#startbtn');
  const count = Math.min(len, t);
  b.disabled = n === 0 || t < 10 || busy;
  b.textContent = busy ? 'Getting questions…' : n === 0 ? 'Pick at least one chapter' : t < 10 ? 'Not enough questions yet' : `Start · ${Math.ceil(count / 10)} rounds of 10 →`;
  const w = $('#pickwarn');
  w.hidden = !(n > 0 && t >= 10 && t < len);
  if (!w.hidden) w.textContent = `Only ${t} questions in these chapters, so this practice will have ${t}.`;
}

function setLen(v) {
  len = v; prefs.set('lastLen', v);
  $$('.len').forEach(x => { const on = +x.dataset.len === v; x.classList.toggle('on', on); x.setAttribute('aria-checked', on); });
}

/** v3.0: offer Boss Intel before a battle on a chapter that has a lesson and no charge (once per chapter per day). */
async function scoutPrompt(ids) {
  if (app.viewAs || app.profile?.role === 'admin') return false;
  let charges = {}, lidx = {};
  try { [charges, lidx] = await Promise.all([intelCharges(app.user.id), lessonsMeta()]); } catch { return false; }
  const today = new Date().toISOString().slice(0, 10), asked = prefs.get('scoutAsked', {});
  const seen = asked.d === today ? asked.ids || [] : [];
  const cand = ids.filter(id => lidx[id] && !charges[id] && !seen.includes(id));
  if (!cand.length) return false;
  prefs.set('scoutAsked', { d: today, ids: [...seen, ...cand] });
  const ch = cat.chapters.find(c => c.chapter_id === cand[0]);
  const boss = ch ? bossName(ch, subjectMeta(cat.subjects.find(s => s.id === ch.subject_id)).key).name : 'this boss';
  const v = await sheet({
    title: 'Scout first?',
    body: `<p>Read short <b>Intel cards</b> about <b>${esc(boss)}</b> (≈1 min each) and this battle gets:</p><p>🛡️ Shield · ⚡ Weak spot ×2 · ✨ +20% XP</p>`,
    actions: [{ label: '📜 Read intel first', value: 'read', cls: 'primary' }, { label: '⚔️ Fight now', value: 'fight' }],
  });
  return v === 'read' ? cand[0] : v === 'fight' ? false : null;
}

async function start() {
  if (busy) return;
  const ids = cat.chapters.filter(c => sel.has(c.chapter_id)).map(c => c.chapter_id);
  const go = () => mode === 'normal' ? startAttempt(ids, len) : startMode(mode, mode === 'revenge' ? null : ids);
  const scout = mode === 'normal' ? await scoutPrompt(ids) : false;
  if (scout === null) return;
  if (scout) { prefs.set('lastChapters', ids); navigate(`#/intel/${scout}/read`); return; }
  busy = true; updateMeta();
  try {
    let data;
    try {
      data = await go();
    } catch (e) {
      if (e.code !== 'in_progress') throw e;
      const ip = await inProgressAttempt(app.user.id);
      const choice = await sheet({
        title: 'You have a practice in progress',
        body: ip ? `${ip.answered_count}/${ip.total_questions} answered. Continue it, or start fresh?${ip.answered_count ? ' Starting fresh counts as a Retreat and costs XP.' : ''}` : 'Continue it, or start fresh?',
        actions: [{ label: 'Continue it', value: 'continue', cls: 'primary' }, { label: 'Start fresh', value: 'fresh' }],
      });
      if (choice === 'continue' && ip) { navigate(`#/quiz/${ip.id}`); return; }
      if (choice !== 'fresh') return;
      if (ip && !(await confirmRetreat(ip))) return;
      data = await go();
    }
    prefs.set('lastChapters', ids);
    navigate(`#/quiz/${data.attempt.id}`);
  } catch (e) {
    toast(e.message, 3500);
  } finally {
    busy = false; if (cat) updateMeta();
  }
}

/** #/pick/<chapterId> (from Learn / Progress) preselects just that chapter */
export async function renderPick(arg) {
  const [preset, wantLen] = String(arg || '').split('~');
  show('pick');
  $('#chaplist').innerHTML = '<div class="loading" style="height:30vh"><div class="spin"></div></div>';
  try { cat = await catalog(true); } catch (e) { $('#chaplist').innerHTML = `<div class="panel sunk empty">${esc(e.message)}</div>`; return; }
  $('#capnote').hidden = true;
  if (!app.viewAs && app.profile?.role !== 'admin') loadProgress().then(p => {
    const capN = +cat.rules?.daily_cap || 90, n = p?.answers_today || 0;
    if (n < capN) return;
    const el = $('#capnote'); el.hidden = false;
    el.innerHTML = `💤 You answered <b class="num">${n}</b> questions today and reached the XP cap. You can still practise (it trains your bosses), but no XP until tomorrow. Resting is training too!`;
  }).catch(() => { /* note is optional */ });
  if (preset && preset.startsWith('sub:')) {          // from the schedule: subject tab, no chapters linked yet
    const sid = preset.slice(4);
    if (cat.subjects.some(s => s.id === sid)) { curSub = sid; sel.clear(); }
    history.replaceState(null, '', '#/pick');
  } else if (preset) {                                 // one chapter, or several (comma list) from the schedule
    const ids = preset.split(',').filter(id => cat.chapters.some(c => c.chapter_id === id && avail(c)));
    if (ids.length) {
      sel.clear(); ids.forEach(id => sel.add(id));
      curSub = cat.chapters.find(c => c.chapter_id === ids[0]).subject_id;
    }
    history.replaceState(null, '', '#/pick');
  }
  if (preset) mode = 'normal';   // a chapter link (Intel, Learn, Progress) always opens a normal battle
  // drop remembered chapters that no longer exist or are empty
  for (const id of [...sel]) { const c = cat.chapters.find(x => x.chapter_id === id); if (!c || !avail(c)) sel.delete(id); }
  if (!curSub || !cat.subjects.some(s => s.id === curSub)) {
    const firstSel = cat.chapters.find(c => sel.has(c.chapter_id));
    curSub = firstSel ? firstSel.subject_id : cat.subjects[0]?.id;
  }
  if (wantLen === '50' || wantLen === '30') len = +wantLen;
  setLen(len);
  renderSubtabs(); renderChapters(); renderModes(); updateMeta();
  revengeCount().then(n => { revN = n; renderModes(); updateMeta(); }).catch(() => { revN = 0; renderModes(); updateMeta(); });
  loadReports().then(r => { bms = benchmarks(r); if (cat) renderSubtabs(); }).catch(() => { /* banner is optional */ });
}

/* events (bound once) */
$('#subtabs').addEventListener('click', e => {
  const b = e.target.closest('[data-sub]'); if (!b) return;
  curSub = b.dataset.sub; renderSubtabs(); renderChapters();
  b.scrollIntoView({ block: 'nearest', inline: 'nearest' });
});
$('#chaplist').addEventListener('click', e => {
  const b = e.target.closest('[data-ch]'); if (!b) return;
  const id = b.dataset.ch; sel.has(id) ? sel.delete(id) : sel.add(id);
  renderSubtabs(); renderChapters();
});
$$('.len').forEach(b => b.addEventListener('click', () => { setLen(+b.dataset.len); updateMeta(); }));
$('#startbtn').addEventListener('click', start);
