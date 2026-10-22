// Home (DESIGN §5.2): greeting, streak + level tiles, Continue card, CTA, recent battles.
import { $, esc, setMascot, FLAME, prettyDay, shortDay, jakartaDate, fmtNum, levelInfo, scoreCls, sheet, toast, shortCode } from '../ui.js';
import { loadProgress, progressOf, abandonStale, inProgressAttempt, completedAttempts, signOut, changePassword, abandonAttempt, myGoals, loadAssessments, myLessonReads, loadDojo } from '../store.js';
import { studyPlan } from '../plan.js';
import { lessonsMeta } from './learn.js';
import { upcoming, assessmentRow, phase, dateRange, KIND, LOOKAHEAD_DAYS } from '../schedule.js';
import { goalStatus } from '../goals.js';
import { app, catalog, chapterIndex, firstName, viewerId } from '../state.js';
import { show, navigate } from '../router.js';
import { dojoFrom, bindHomeDojo } from './dojo.js';
import { STAGE_ART } from '../hero/art.js';
import { confirmRetreat } from '../retreat.js';
import { myRetreats, markRetreatsSeen } from '../store.js';
import { RANKS } from '../dojo.js';
import { FAMILIES, familyPortrait, monsterSVG } from '../monsters.js';


export function chaptersLabel(ids, idx) {
  const bySub = new Map();
  for (const id of ids || []) {
    const c = idx[id]; if (!c) continue;
    const sname = c.subject?.name || '';
    const short = { 'Mathematics': 'Math', 'Bahasa Indonesia': 'B. Indonesia', 'Pendidikan Pancasila': 'Pancasila', 'Pendidikan Agama': 'Agama' }[sname] || sname;
    if (!bySub.has(short)) bySub.set(short, []);
    bySub.get(short).push(String(c.code).split('-').pop());
  }
  return [...bySub].map(([s, codes]) => `${s} ${codes.join(' · ')}`).join(' + ') || 'Practice';
}

export function recRow(a, idx) {
  return `<button class="rec" data-nav="#/session/${a.id}"><div class="score-pill num ${scoreCls(a.score)}">${a.score}</div>
    <div class="grow"><div class="t">${esc(chaptersLabel(a.chapter_ids, idx))}</div><div class="note num">${esc(shortDay(a.finished_at))} · ${a.total_questions} questions</div></div>
    <span aria-hidden="true" style="color:var(--ink-3);font-weight:900">›</span></button>`;
}

function weekStrip(doneDates) {
  const out = [];
  const today = jakartaDate();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const key = jakartaDate(d);
    const letter = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', weekday: 'narrow' }).format(d);
    const cls = [doneDates.has(key) ? 'done' : '', key === today ? 'today' : ''].join(' ').trim();
    out.push(`<b class="${cls}" title="${esc(shortDay(d))}${doneDates.has(key) ? ' · practised' : ''}">${letter}</b>`);
  }
  return `<div class="days" aria-label="Last 7 days">${out.join('')}</div>`;
}

export async function renderHome() {
  show('home');
  const body = $('#home-body');
  if (!body.dataset.ready) body.innerHTML = `<div class="loading" style="height:60vh"><div><div class="spin" style="margin:0 auto 12px"></div>Loading…</div></div>`;
  const viewing = !!app.viewAs;            // admin sees the student's Home, read-only
  const vid = viewerId();
  let cat, prog, inprog, done, goals, asms, reads, lessons, dj;
  try {
    if (!viewing) await abandonStale();
    [cat, prog, inprog, done, goals, asms, reads, lessons, dj] = await Promise.all([catalog(), viewing ? progressOf(vid) : loadProgress(), inProgressAttempt(vid), completedAttempts(vid, 40), myGoals(vid),
      loadAssessments().catch(() => []), myLessonReads(vid), lessonsMeta().catch(() => ({})), loadDojo(vid).catch(() => ({ beaten: {}, exams: [] }))]);
  } catch (e) {
    body.innerHTML = `<div class="panel sunk empty" style="margin-top:40px"><p>${esc(e.message)}</p><button class="btn block" style="margin-top:12px" data-nav="#/home">Try again ↻</button></div>`;
    return;
  }
  const idx = chapterIndex(cat);
  const dd = dojoFrom(cat, prog, dj, viewing);
  const lv = levelInfo(prog?.xp_total || 0);
  const doneDates = new Set(done.map(a => jakartaDate(a.finished_at)));
  const streak = prog?.current_streak || 0;
  const today = jakartaDate();
  const ctx = { sessionsToday: done.filter(a => jakartaDate(a.finished_at) === today).length, statBy: cat.statBy,
    chapterName: (id) => { const c = idx[id]; return c ? `${chaptersLabel([id], idx)} ${c.name}` : 'Chapter'; }, minAnswered: +cat.rules?.min_answered || 15 };
  const missions = (goals || []).map(g => goalStatus(g, ctx)).filter(m => m.status !== 'hidden');
  const chipFor = { done: ['Done', 'var(--ok)'], pending: ['Pending', 'var(--volt-2)'], overdue: ['Overdue', 'var(--bad)'] };
  const mission = missions.length ? `<div class="panel mission"><div class="eyebrow">Today's mission from Dad</div>${missions.map(m =>
    `<div class="item"><div class="grow"><div style="font-weight:900;color:var(--ink);font-size:16px">${esc(m.title)}</div><div class="note">${esc(m.detail)}</div></div>
     <span class="chip" style="--c:${chipFor[m.status][1]}"><span class="dot"></span>${chipFor[m.status][0]}</span></div>`).join('')}</div>` : '';

  const soon = upcoming(asms || []);
  const urgent = soon.some(a => ['now', 'soon'].includes(phase(a, today)));
  const nextOne = (asms || []).find(a => a.date_start > today && !soon.includes(a));
  const comingUp = (asms || []).length ? `<div class="panel upnext ${urgent ? 'alert' : ''}">
      <div class="row between" style="margin-bottom:4px"><div class="eyebrow">${urgent ? 'Heads up · assessment soon' : `Coming up · next ${LOOKAHEAD_DAYS} days`}</div><button class="btn ghost xs" data-nav="#/schedule">Calendar</button></div>
      ${soon.length ? `<div class="asm-list">${soon.map(a => assessmentRow(a, { idx, statBy: cat.statBy, today, readonly: viewing })).join('')}</div>`
        : `<p class="note" style="font-size:14px">No assessments in the next ${LOOKAHEAD_DAYS} days.${nextOne ? ` Next: <b>${esc(nextOne.subject_name)}</b> · ${esc((KIND[nextOne.kind] || {}).label || '')} · ${esc(dateRange(nextOne))}.` : ''}</p>`}
    </div>` : '';

  const plan = studyPlan(asms || [], { cat, idx, attempts: done, reads, lessons, today });
  const planDone = plan.filter(p => p.done).length;
  const planCard = plan.length ? `<div class="panel plan">
      <div class="row between" style="margin-bottom:4px"><div class="eyebrow">Study plan · today</div><span class="note num">${planDone}/${plan.length} done</span></div>
      ${plan.map(p => `<div class="item">
        <div class="hday num">H-${p.daysLeft}</div>
        <div class="grow"><div class="pt">${esc(p.title)}</div><div class="note">${esc(p.detail)}</div></div>
        ${p.done ? '<span class="chip" style="--c:var(--ok)"><span class="dot"></span>Done</span>'
          : viewing || !p.action ? '<span class="chip" style="--c:var(--volt-2)"><span class="dot"></span>To do</span>'
          : `<button class="btn small primary" data-nav="${p.action.hash}">${esc(p.action.label)}</button>`}
      </div>`).join('')}
    </div>` : '';

  // Dad's view: a practice untouched for stale_hours (24) counts as left behind (Sadli, 21 Oct 2026); it closes when Mikha next opens the app.
  const staleMs = (+(cat.rules || {}).stale_hours || 24) * 3600000;
  if (viewing && inprog && Date.now() - new Date(inprog.last_answered_at || inprog.started_at).getTime() > staleMs) inprog = null;
  const resume = viewing ? (inprog ? `<div class="panel sunk"><div class="eyebrow">Practice in progress</div><div style="font-weight:900;color:var(--ink)">${esc(chaptersLabel(inprog.chapter_ids, idx))} · <span class="num">${inprog.answered_count}/${inprog.total_questions}</span> answered</div></div>` : '') : inprog ? `
    <div class="panel cta resume">
      <div class="lines"></div>
      <div class="eyebrow">Practice in progress</div>
      <h2>Continue · <span class="num">${inprog.answered_count}/${inprog.total_questions}</span></h2>
      <p style="color:var(--volt-ink);font-weight:800;margin:-6px 0 12px">${esc(chaptersLabel(inprog.chapter_ids, idx))}</p>
      <button class="btn primary lg block" data-nav="#/quiz/${inprog.id}">Continue →</button>
      <button class="btn ghost block" id="freshbtn" style="margin-top:8px;color:var(--volt-ink);border-color:var(--volt-ink)">Start fresh instead</button>
    </div>` : '';
  const cta = viewing ? `<div class="panel sunk viewbar"><div class="grow"><div class="eyebrow">Dad's view</div><div class="note" style="font-size:13.5px">You are watching ${esc(app.viewAs.name)}'s studio. Your own practices don't count for ${esc(app.viewAs.name.split(' ')[0])}.</div></div>
      <div class="row" style="gap:8px;flex-wrap:wrap"><button class="btn small" data-nav="#/admin/student">Details</button><button class="btn small" data-nav="#/admin/schedule">Schedule</button><button class="btn small ghost" data-nav="#/pick">Try a practice</button></div></div>` : `
    <div class="panel ${inprog ? '' : 'cta'}">
      ${inprog ? '' : '<div class="lines"></div>'}
      <div class="eyebrow">${inprog ? 'Or' : 'Ready?'}</div>
      <h2 style="font-size:${inprog ? 24 : 30}px;margin:2px 0 12px;${inprog ? '' : 'color:var(--volt-ink)'}">Start a practice</h2>
      <button class="btn ${inprog ? '' : 'primary lg'} block" data-nav="#/pick">Pick chapters →</button>
    </div>`;

  const hi = (html, n) => html ? `<div class="hitem" style="order:${n}">${html}</div>` : '';
  // ---- v2.3 Night Dojo home ----
  const { rk, R, bosses } = dd;
  const nAns = prog?.answers_today || 0, kiPct = Math.min(100, Math.round(100 * nAns / R.target));
  const pr = { revived: 0, cracked: 1, fight: 2 };
  const next = bosses.find(b => b.angry && b.phase !== 'sealed') || bosses.filter(b => b.st.status in pr).sort((a, b) => pr[a.st.status] - pr[b.st.status] || a.st.hp - b.st.hp)[0]
    || bosses.find(b => b.phase !== 'sealed' && b.phase !== 'new');
  const say = viewing ? `Watching ${esc(app.viewAs.name.split(' ')[0])}'s progress.`
    : inprog ? 'Let\'s finish the practice we started!'
    : next?.st.status === 'revived' ? `${esc(next.name)} broke its seal! Let\'s seal it again.`
    : nAns >= R.cap ? 'XP cap reached. Great work, rest now!'
    : nAns >= R.target ? 'Mission done! Every answer now is bonus XP.'
    : streak > 1 ? `${streak} days in a row! Keep the streak alive.`
    : 'Ready to train? Pick a monster to hunt.';
  const greet = `<div class="hm-greet">
      <div class="hm-ava" style="--belt:${rk.color};background-image:url(${STAGE_ART(rk.rank)})" aria-hidden="true"></div>
      <div class="grow"><div class="nd-label">${esc(prettyDay())} · ${esc(rk.belt)}${viewing ? ' · Dad\'s view' : ''}</div>
        <div class="nd-h1">${viewing ? `${esc(app.viewAs.name.split(' ')[0])}'s studio` : `Hey, ${esc(firstName())}!`}</div></div>
    </div>
    <div class="hm-bubble">${say}</div>`;
  const missionCard = `<div class="nd-card hm-mission">
      <div class="row between"><div class="nd-label">Today's mission</div><span class="nd-label" style="color:var(--nd-gold)">Level ${lv.level} · ${esc(lv.tier)}</span></div>
      <div class="row" style="gap:14px;margin-top:10px;align-items:center">
        <div class="hm-ring" style="--p:${kiPct}" role="progressbar" aria-valuemin="0" aria-valuemax="${R.target}" aria-valuenow="${Math.min(nAns, R.target)}" aria-label="Answers today"><b class="num">${nAns}</b></div>
        <div class="grow"><div class="nd-h2" style="font-size:18px">${nAns >= R.cap ? 'XP cap reached' : nAns >= R.target ? 'Mission done ✓' : `${R.target - nAns} answers to go`}</div>
          <div class="nd-sub num">Target ${R.target} · ${fmtNum(lv.toNext)} XP to Level ${lv.level + 1}</div>
          <div class="nd-bar" style="margin-top:8px"><i style="--p:${lv.pct}%"></i></div></div>
      </div>
      <div class="row between" style="margin-top:12px;align-items:flex-end">${weekStrip(doneDates)}
        <div class="hm-streak"><b class="num">${streak}</b><span>day streak${prog?.freeze_ready ? ' · 🛡️' : ''}</span></div></div>
    </div>`;
  const bossCard = next ? `<div class="nd-card hm-boss nextboss" data-boss="${next.ch.chapter_id}" style="--fc:${FAMILIES[next.fam].c}">
      <div class="art">${monsterSVG(next.ch, { phase: next.phase, size: 128, angry: next.angry })}</div>
      <div class="grow" style="min-width:0"><div class="nd-label" style="color:${next.st.status === 'revived' ? '#FF8A9A' : 'var(--nd-dim)'}">${next.angry ? '😠 Angry · you retreated' : next.st.status === 'revived' ? '● Came back' : next.st.status === 'cracked' ? '● Seal cracking' : 'Next target'}</div>
        <div class="nd-h2">${esc(next.name)}</div><div class="nd-sub">${esc(next.title)} · ${esc(next.m.short)} ${esc(shortCode(next.ch.code))}</div>
        <div class="hp" style="margin:8px 0 10px" aria-label="HP ${next.st.hp}%"><i style="--p:${next.st.hp}%"></i></div>
        ${viewing ? `<span class="nd-sub num">HP ${next.st.hp}%</span>` : '<button class="nd-btn primary small" data-fight>Fight 30 →</button>'}</div>
    </div>` : '';
  const examOpen = rk.ready && !viewing && !dd.triedToday ? `<button class="nd-card hm-exam" data-nav="#/dojo"><span class="nd-label" style="color:var(--nd-gold)">Exam gate open</span><b>Rank exam for ${esc(rk.next.name)} →</b></button>` : '';
  const fams = Object.keys(FAMILIES).map(k => ({ k, f: FAMILIES[k], list: bosses.filter(b => b.fam === k) })).filter(x => x.list.length);
  const worlds = fams.length ? `<div><div class="nd-sec"><div class="nd-h2">Your worlds</div><button class="nd-link" data-nav="#/bosses">${dd.beatNow}/${bosses.length} sealed ›</button></div>
      <div class="hm-worlds">${fams.map(({ k, f, list }) => { const sealed = list.filter(b => b.phase === 'sealed').length; return `<button class="hm-world" data-nav="#/bosses/${k}" style="--c:${f.c}">
        ${familyPortrait(k, 76)}<b>${esc(list[0].m.short)}</b><small class="num">${sealed}/${list.length} sealed</small><div class="nd-bar"><i style="--p:${Math.max(4, Math.round(100 * sealed / list.length))}%;--bc:${f.c}"></i></div></button>`; }).join('')}</div></div>` : '';
  const startCta = viewing || inprog ? '' : `<div class="nd-card hm-start"><span class="hm-kanji" aria-hidden="true">修</span><div class="nd-label">Free training</div><div class="nd-h2" style="margin:2px 0 10px">Pick your own chapters</div><button class="nd-btn primary" data-nav="#/pick">Start a practice →</button></div>`;
  const resumeNd = resume.replace('panel cta resume', 'nd-card emph hm-resume');
  const ctaNd = viewing ? cta : '';

  let rt = null; try { rt = await myRetreats(vid); } catch { /* notice is optional */ }
  const unseen = (rt?.unseen || []);
  const rtCard = viewing ? ''   // Dad's view: covered by the 'Perlu perhatian' summary
    : unseen.length ? `<div class="nd-card hm-retreat" id="rtcard"><div class="nd-label" style="color:#FF9A9A">😠 Retreat recorded</div>
      ${unseen.map(r => `<div class="rt-line"><span>${r.auto ? 'Practice left for 24 hours' : `Retreat #${r.nth} today`}</span><b class="num">−${r.xp_lost} XP</b></div>${r.rank_after < r.rank_before ? `<div class="rt-line drop">Belt dropped to ${esc(RANKS[r.rank_after]?.belt || '')}. Pass the exam again to win it back.</div>` : ''}`).join('')}
      <p class="nd-sub" style="margin:6px 0 10px">Finish your battles to calm the angry monsters. Wrong answers come back first.</p>
      <button class="nd-btn small" id="rtok">Got it</button></div>` : '';
  body.innerHTML = `<div class="nd-stack hm">
    ${greet}
    ${rtCard}
    <div class="hgrid">
    <div class="hmain">
    ${hi(resumeNd, 1)}${viewing ? '' : '<div class="hitem" style="order:2" id="questslot"></div>'}${hi(ctaNd, 2)}${hi(bossCard, 3)}${hi(examOpen, 4)}${hi(planCard, 6)}${hi(mission, 7)}${hi(worlds, 8)}${hi(startCta, 9)}
    <div class="hitem" style="order:10">
      <div class="nd-sec"><div class="nd-h2">Recent battles</div>${done.length ? '<button class="nd-link" data-nav="#/history">All ›</button>' : ''}</div>
      <div class="recent">${done.length ? done.slice(0, 3).map(a => recRow(a, idx)).join('') :
        '<div class="panel sunk empty" style="font-size:15px">No battles yet. Your first practice shows up here.</div>'}</div>
    </div>
    </div>
    <aside class="hside">
    ${hi(missionCard, 0)}
    ${hi(comingUp, 5)}
    </aside>
    </div>
    <div class="row between" style="margin-top:6px;flex-wrap:wrap;gap:8px">
      <span class="nd-sub" style="font-size:12px">Signed in as ${esc(app.profile?.display_name || '')}${app.profile?.role === 'admin' ? ' · admin' : ''}</span>
      <span class="row" style="gap:8px">${app.profile?.role === 'admin' ? '<button class="btn ghost small" data-nav="#/admin/overview">Admin</button>' : ''}<button class="btn ghost small" id="pwbtn">Password</button><button class="btn ghost small" id="signout">Sign out</button></span>
    </div>
  </div>`;
  body.dataset.ready = '1';
  bindHomeDojo(body, dd);
  if (!viewing) import('../quests.js').then(m => m.mountQuests($('#questslot'))).catch(() => { /* quests are optional */ });
  if (viewing) import('./admin/overview.js').then(async m => {   // Dad's view: the admin "Perlu perhatian" summary on top (v2.7.0)
    const o = await m.overviewData(); const el = document.createElement('div'); el.className = 'hm-dad';
    el.innerHTML = m.attentionCard(m.attentionItems(o), { title: 'Perlu perhatian · untuk Dad' }) + '<button class="nd-link" data-nav="#/admin/overview" style="margin-top:6px">Buka dashboard admin ›</button>';
    body.querySelector('.hm')?.prepend(el);
  }).catch(() => { /* summary is optional */ });
  const rto = $('#rtok'); if (rto) rto.onclick = () => { markRetreatsSeen(); $('#rtcard')?.remove(); };

  $('#pwbtn').onclick = () => passwordSheet();
  if (wantPw) { const o = wantPw; wantPw = null; passwordSheet(o); }
  $('#signout').onclick = async () => {
    const ok = await sheet({ title: 'Sign out?', body: 'You will need your email and password to come back in.', actions: [{ label: 'Stay signed in', value: false }, { label: 'Sign out', value: true, cls: 'danger' }] });
    if (ok) await signOut();
  };
  const fresh = $('#freshbtn');
  if (fresh) fresh.onclick = async () => {
    try { if (await confirmRetreat(inprog, { keepLabel: 'Keep it' })) navigate('#/pick'); } catch (e) { toast(e.message, 3000); }
  };
}

/** Opened from a password-reset link: show the new-password sheet once Home is drawn. */
let wantPw = null;
export const openPasswordOnHome = (opts) => { wantPw = opts; };

/** Change own password (FR-04). The new password is typed by the user; the app never shows or stores it. */
function passwordSheet({ recovery = false } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'sheet'; wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-modal', 'true'); wrap.setAttribute('aria-label', 'Change password');
  wrap.innerHTML = `<div class="panel"><h3>${recovery ? 'Set a new password' : 'Change password'}</h3>${recovery ? '<p class="note">Your reset link worked. Choose a new password for this account.</p>' : ''}
    <div class="stack" style="gap:10px;margin:8px 0"><div class="field"><label for="pw1">New password (8+ characters)</label><input type="password" id="pw1" autocomplete="new-password" minlength="8"></div>
    <div class="field"><label for="pw2">Type it again</label><input type="password" id="pw2" autocomplete="new-password" minlength="8"></div></div>
    <p class="note" id="pwmsg" style="min-height:1.2em"></p>
    <div class="stack" style="gap:10px"><button class="btn block primary" id="pwsave">Save new password</button><button class="btn block" id="pwcancel">Cancel</button></div></div>`;
  const close = () => wrap.remove();
  wrap.addEventListener('click', e => { if (e.target === wrap) close(); });
  $('#app').appendChild(wrap);
  $('#pwcancel', wrap).onclick = close;
  $('#pw1', wrap).focus();
  $('#pwsave', wrap).onclick = async () => {
    const a = $('#pw1', wrap).value, b = $('#pw2', wrap).value, msg = $('#pwmsg', wrap);
    if (a.length < 8) { msg.textContent = 'Use at least 8 characters.'; return; }
    if (a !== b) { msg.textContent = 'The two passwords are not the same.'; return; }
    const btn = $('#pwsave', wrap); btn.disabled = true; msg.textContent = 'Saving…';
    try { await changePassword(a); close(); toast('Password changed. Use the new one next time you sign in.', 3000); }
    catch (e) { btn.disabled = false; msg.textContent = e.message; }
  };
}
