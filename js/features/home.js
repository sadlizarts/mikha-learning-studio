// Home (DESIGN §5.2): greeting, streak + level tiles, Continue card, CTA, recent battles.
import { $, esc, setMascot, FLAME, prettyDay, shortDay, jakartaDate, fmtNum, levelInfo, scoreCls, sheet, toast } from '../ui.js';
import { loadProgress, progressOf, abandonStale, inProgressAttempt, completedAttempts, signOut, changePassword, abandonAttempt, myGoals, loadAssessments, myLessonReads, loadDojo } from '../store.js';
import { studyPlan } from '../plan.js';
import { lessonsMeta } from './learn.js';
import { upcoming, assessmentRow, phase, dateRange, KIND, LOOKAHEAD_DAYS } from '../schedule.js';
import { goalStatus } from '../goals.js';
import { app, catalog, chapterIndex, firstName, viewerId } from '../state.js';
import { show, navigate } from '../router.js';
import { dojoFrom, homeDojo, bindHomeDojo } from './dojo.js';

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
  body.innerHTML = `<div class="stack">
    <div class="row between greet">
      <div><div class="eyebrow">${esc(prettyDay())}${viewing ? ' · Dad\'s view' : ''}</div><h1>${viewing ? `${esc(app.viewAs.name.split(' ')[0])}'s studio` : `Hey ${esc(firstName())}!`}</h1></div>
      <div class="mascot" id="m-home"></div>
    </div>
    <div class="hgrid">
    <div class="hmain">
    ${hi(resume, 5)}${hi(cta, 6)}${hi(planCard, 3)}${hi(mission, 4)}
    <div class="hitem" style="order:7">
      <div class="row between" style="margin-bottom:8px"><h3 style="font-size:20px">Recent battles</h3>${done.length ? '<button class="btn ghost small" data-nav="#/history">All</button>' : ''}</div>
      <div class="recent">${done.length ? done.slice(0, 3).map(a => recRow(a, idx)).join('') :
        '<div class="panel sunk empty" style="font-size:15px">No battles yet. Your first practice shows up here.</div>'}</div>
    </div>
    </div>
    <aside class="hside">
    <div class="statrow hitem" style="order:1">
      <div class="panel stat">
        <div class="eyebrow">Streak</div>
        <div class="big num">${FLAME} ${streak}<small>${streak === 1 ? 'day' : 'days'}</small></div>
        ${weekStrip(doneDates)}
        <div class="note num" style="margin-top:6px">Best ${prog?.best_streak || 0}${prog?.freeze_needed && prog?.freeze_ready && streak ? ' · 🛡️ shield on today' : prog?.freeze_ready ? ' · 🛡️ ready' : ''}</div>
      </div>
      <div class="panel stat">
        <div class="eyebrow">Level ${lv.level} · ${lv.tier}</div>
        <div class="big num">${fmtNum(prog?.xp_total || 0)}<small>XP</small></div>
        <div class="xpbar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${lv.pct}" aria-label="Progress to next level"><i style="--p:${lv.pct}%"></i></div>
        <div class="note num" style="margin-top:6px">${fmtNum(lv.toNext)} XP to Level ${lv.level + 1}</div>
      </div>
    </div>
    ${hi(homeDojo(dd), 1)}
    ${hi(comingUp, 2)}
    </aside>
    </div>
    <div class="row between" style="margin-top:6px">
      <span class="note">Signed in as ${esc(app.profile?.display_name || '')}${app.profile?.role === 'admin' ? ' · admin' : ''}</span>
      <span class="row" style="gap:8px">${app.profile?.role === 'admin' ? '<button class="btn ghost small" data-nav="#/admin/import">Admin</button>' : ''}<button class="btn ghost small" id="pwbtn">Password</button><button class="btn ghost small" id="signout">Sign out</button></span>
    </div>
  </div>`;
  body.dataset.ready = '1';
  setMascot($('#m-home'), 'neutral');
  bindHomeDojo(body, dd);

  $('#pwbtn').onclick = () => passwordSheet();
  if (wantPw) { const o = wantPw; wantPw = null; passwordSheet(o); }
  $('#signout').onclick = async () => {
    const ok = await sheet({ title: 'Sign out?', body: 'You will need your email and password to come back in.', actions: [{ label: 'Stay signed in', value: false }, { label: 'Sign out', value: true, cls: 'danger' }] });
    if (ok) await signOut();
  };
  const fresh = $('#freshbtn');
  if (fresh) fresh.onclick = async () => {
    const ok = await sheet({ title: 'Start fresh?', body: `Your ${inprog.answered_count} answers still count for your chapter stats, but this practice won't get a score.`, actions: [{ label: 'Keep it', value: false }, { label: 'Start fresh', value: true, cls: 'danger' }] });
    if (!ok) return;
    try { await abandonAttempt(inprog.id); navigate('#/pick'); } catch (e) { toast(e.message, 3000); }
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
