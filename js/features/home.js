// Home (DESIGN §5.2): greeting, streak + level tiles, Continue card, CTA, recent battles.
import { $, esc, setMascot, FLAME, prettyDay, shortDay, jakartaDate, fmtNum, levelInfo, scoreCls, sheet, toast } from '../ui.js';
import { loadProgress, abandonStale, inProgressAttempt, completedAttempts, signOut, abandonAttempt, myGoals } from '../store.js';
import { goalStatus } from '../goals.js';
import { app, catalog, chapterIndex, firstName } from '../state.js';
import { show, navigate } from '../router.js';

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
  let cat, prog, inprog, done, goals;
  try {
    await abandonStale();
    [cat, prog, inprog, done, goals] = await Promise.all([catalog(), loadProgress(), inProgressAttempt(app.user.id), completedAttempts(app.user.id, 40), myGoals(app.user.id)]);
  } catch (e) {
    body.innerHTML = `<div class="panel sunk empty" style="margin-top:40px"><p>${esc(e.message)}</p><button class="btn block" style="margin-top:12px" data-nav="#/home">Try again ↻</button></div>`;
    return;
  }
  const idx = chapterIndex(cat);
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

  const resume = inprog ? `
    <div class="panel cta resume">
      <div class="lines"></div>
      <div class="eyebrow">Practice in progress</div>
      <h2>Continue · <span class="num">${inprog.answered_count}/${inprog.total_questions}</span></h2>
      <p style="color:var(--volt-ink);font-weight:800;margin:-6px 0 12px">${esc(chaptersLabel(inprog.chapter_ids, idx))}</p>
      <button class="btn primary lg block" data-nav="#/quiz/${inprog.id}">Continue →</button>
      <button class="btn ghost block" id="freshbtn" style="margin-top:8px;color:var(--volt-ink);border-color:var(--volt-ink)">Start fresh instead</button>
    </div>` : '';
  const cta = `
    <div class="panel ${inprog ? '' : 'cta'}">
      ${inprog ? '' : '<div class="lines"></div>'}
      <div class="eyebrow">${inprog ? 'Or' : 'Ready?'}</div>
      <h2 style="font-size:${inprog ? 24 : 30}px;margin:2px 0 12px;${inprog ? '' : 'color:var(--volt-ink)'}">Start a practice</h2>
      <button class="btn ${inprog ? '' : 'primary lg'} block" data-nav="#/pick">Pick chapters →</button>
    </div>`;

  body.innerHTML = `<div class="stack">
    <div class="row between greet">
      <div><div class="eyebrow">${esc(prettyDay())}</div><h1>Hey ${esc(firstName())}!</h1></div>
      <div class="mascot" id="m-home"></div>
    </div>
    <div class="statrow">
      <div class="panel stat">
        <div class="eyebrow">Streak</div>
        <div class="big num">${FLAME} ${streak}<small>${streak === 1 ? 'day' : 'days'}</small></div>
        ${weekStrip(doneDates)}
        <div class="note num" style="margin-top:6px">Best ${prog?.best_streak || 0}</div>
      </div>
      <div class="panel stat">
        <div class="eyebrow">Level ${lv.level} · ${lv.tier}</div>
        <div class="big num">${fmtNum(prog?.xp_total || 0)}<small>XP</small></div>
        <div class="xpbar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${lv.pct}" aria-label="Progress to next level"><i style="--p:${lv.pct}%"></i></div>
        <div class="note num" style="margin-top:6px">${fmtNum(lv.toNext)} XP to Level ${lv.level + 1}</div>
      </div>
    </div>
    ${mission}
    ${resume}
    ${cta}
    <div>
      <div class="row between" style="margin-bottom:8px"><h3 style="font-size:20px">Recent battles</h3>${done.length ? '<button class="btn ghost small" data-nav="#/history">All</button>' : ''}</div>
      <div class="recent">${done.length ? done.slice(0, 3).map(a => recRow(a, idx)).join('') :
        '<div class="panel sunk empty" style="font-size:15px">No battles yet. Your first practice shows up here.</div>'}</div>
    </div>
    <div class="row between" style="margin-top:6px">
      <span class="note">Signed in as ${esc(app.profile?.display_name || '')}${app.profile?.role === 'admin' ? ' · admin' : ''}</span>
      <span class="row" style="gap:8px">${app.profile?.role === 'admin' ? '<button class="btn ghost small" data-nav="#/admin/import">Admin</button>' : ''}<button class="btn ghost small" id="signout">Sign out</button></span>
    </div>
  </div>`;
  body.dataset.ready = '1';
  setMascot($('#m-home'), 'neutral');

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
