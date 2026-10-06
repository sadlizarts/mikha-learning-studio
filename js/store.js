// All Supabase access goes through this module (CLAUDE.md: one place for retries and the offline queue).
// Writes to session/progress tables happen ONLY via RPC (start_attempt, answer_question, complete_attempt, abandon_*).
import { sb } from './supabase.js';

export class AppError extends Error {
  constructor(code, message, cause) { super(message); this.code = code; this.cause = cause; }
}

const MSG = {
  network: "Can't reach the server. Check your connection and try again.",
  waking: 'The studio is waking up. Ask Dad to check Supabase if this takes more than a minute.',
  auth: 'Your login expired. Please sign in again.',
  unknown: 'Something went wrong. Please try again.',
};

function toAppError(err) {
  if (err instanceof AppError) return err;
  const msg = String(err?.message || err || '');
  if (!navigator.onLine || /Failed to fetch|NetworkError|Load failed|network/i.test(msg)) return new AppError('network', MSG.network, err);
  if (/JWT|not authenticated|401/i.test(msg)) return new AppError('auth', MSG.auth, err);
  if (/attempt in progress/i.test(msg)) return new AppError('in_progress', 'You have a practice in progress.', err);
  if (/not enough questions/i.test(msg)) return new AppError('too_few', 'Not enough questions in these chapters yet.', err);
  if (/already answered/i.test(msg) || err?.code === '23505') return new AppError('already', 'Already answered.', err);
  if (/503|504|upstream|timeout/i.test(msg)) return new AppError('waking', MSG.waking, err);
  return new AppError('unknown', MSG.unknown + (msg ? ` (${msg})` : ''), err);
}

async function run(promise) {
  let res;
  try { res = await promise; } catch (e) { throw toAppError(e); }
  if (res.error) throw toAppError(res.error);
  return res.data;
}

const lsGet = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } };
const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } };
const lsDel = (k) => { try { localStorage.removeItem(k); } catch { /* ignore */ } };
export const prefs = { get: (k, d) => lsGet('mls_pref_' + k, d), set: (k, v) => lsSet('mls_pref_' + k, v) };

/* ---------------- auth ---------------- */
export async function getSession() {
  const { data } = await sb.auth.getSession();
  return data.session || null;
}
export async function signIn(email, password) {
  const { data, error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
  if (error) {
    if (/invalid login credentials/i.test(error.message)) throw new AppError('bad_login', "That email and password don't match. Try again.");
    throw toAppError(error);
  }
  return data.session;
}
export async function signOut() {
  Object.keys(localStorage).filter(k => k.startsWith('mls_attempt_') || k.startsWith('mls_q_')).forEach(lsDel);
  await sb.auth.signOut();
}
export const onAuthChange = (fn) => sb.auth.onAuthStateChange((evt, session) => fn(evt, session));

export async function loadProfile(userId) {
  const rows = await run(sb.from('profiles').select('display_name, role').eq('id', userId).limit(1));
  return rows[0] || { display_name: 'Mikha', role: 'student' };
}

/* ---------------- catalog ---------------- */
export async function loadCatalog(userId) {
  const [subjects, chapters, stats, settings] = await Promise.all([
    run(sb.from('subjects').select('id, name, color, language, sort_order').eq('is_active', true).order('sort_order')),
    run(sb.from('v_chapter_counts').select('chapter_id, subject_id, code, name, sort_order, is_active, active_questions, distinct_items').eq('is_active', true).order('sort_order')),
    run(sb.from('v_chapter_stats').select('chapter_id, answered, accuracy_recent, hint_rate_recent').eq('user_id', userId)),
    run(sb.from('app_settings').select('key, value')).catch(() => []),
  ]);
  const statBy = Object.fromEntries((stats || []).map(s => [s.chapter_id, s]));
  const rules = Object.fromEntries((settings || []).map(r => [r.key, r.value]));
  return { subjects, chapters, statBy, rules };
}

/* ---------------- home / history ---------------- */
export async function loadProgress() { return run(sb.rpc('my_progress')); }

export async function abandonStale() {
  try { await run(sb.rpc('abandon_stale_attempts')); } catch { /* non-fatal */ }
}
export async function inProgressAttempt(userId) {
  const rows = await run(sb.from('attempts').select('id, chapter_ids, requested_length, total_questions, answered_count, started_at')
    .eq('user_id', userId).eq('status', 'in_progress').eq('is_preview', false).order('started_at', { ascending: false }).limit(1));
  return rows[0] || null;
}
export async function completedAttempts(userId, limit = 100) {
  return run(sb.from('attempts').select('id, chapter_ids, total_questions, correct_count, score, finished_at, duration_s, xp_earned')
    .eq('user_id', userId).eq('status', 'completed').eq('is_preview', false).order('finished_at', { ascending: false }).limit(limit));
}

/* ---------------- practice ---------------- */
export async function startAttempt(chapterIds, length) {
  const data = await run(sb.rpc('start_attempt', { p_chapter_ids: chapterIds, p_requested_length: length, p_preview: false }));
  cacheAttempt(data);
  return data;
}
export async function getAttempt(id) {
  const data = await run(sb.rpc('get_attempt', { p_attempt: id }));
  if (!data) throw new AppError('missing', 'This practice could not be found.');
  // merge answers that are still waiting in the offline queue
  for (const p of queueOf(id)) {
    const q = data.questions.find(x => x.question_id === p.qid);
    if (q && !q.answer) q.answer = { chosen_key: p.key, is_correct: p.key === q.answer_key, hint_level: p.hint, pending: true };
  }
  return data;
}
export async function abandonAttempt(id) {
  await run(sb.rpc('abandon_attempt', { p_attempt: id }));
  lsDel('mls_q_' + id); lsDel('mls_attempt_' + id);
}

function cacheAttempt(data) { if (data?.attempt?.id) lsSet('mls_attempt_' + data.attempt.id, data); }
export const cachedAttempt = (id) => lsGet('mls_attempt_' + id, null);

const queueOf = (id) => lsGet('mls_q_' + id, []);
export const pendingCount = (id) => queueOf(id).length;

/** Save one answer. Never throws: on failure the answer waits in localStorage and is retried by flush(). */
export async function saveAnswer(attemptId, qid, key, hint, ms) {
  const q = queueOf(attemptId);
  if (!q.some(x => x.qid === qid)) { q.push({ qid, key, hint, ms }); lsSet('mls_q_' + attemptId, q); }
  return flushAnswers(attemptId);
}

let flushing = null;
export function flushAnswers(attemptId) {
  if (flushing) return flushing.then(() => flushAnswers(attemptId));
  flushing = (async () => {
    let q = queueOf(attemptId);
    while (q.length) {
      const a = q[0];
      try {
        await run(sb.rpc('answer_question', { p_attempt: attemptId, p_question: a.qid, p_chosen: a.key, p_hint_level: a.hint, p_time_ms: a.ms }));
      } catch (e) {
        if (e.code !== 'already') return false; // keep it queued; try again later
      }
      q = queueOf(attemptId).filter(x => x.qid !== a.qid);
      lsSet('mls_q_' + attemptId, q);
    }
    return true;
  })().finally(() => { flushing = null; });
  return flushing;
}

export async function completeAttempt(id) {
  const ok = await flushAnswers(id);
  if (!ok) throw new AppError('network', MSG.network);
  const res = await run(sb.rpc('complete_attempt', { p_attempt: id }));
  lsDel('mls_q_' + id); lsDel('mls_attempt_' + id);
  return res;
}

export async function imageUrl(path) {
  if (!path) return null;
  try {
    const { data } = await sb.storage.from('question-images').createSignedUrl(path, 3600);
    return data?.signedUrl || null;
  } catch { return null; }
}
