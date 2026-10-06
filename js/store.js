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

/* ======================================================================
   Admin (Phase 3). RLS limits every write below to profiles.role = 'admin'.
   ====================================================================== */
export const norm = (s) => String(s ?? '').toLowerCase().trim().replace(/[^\p{L}\p{N}_\s]/gu, '').replace(/\s+/g, ' ');
export async function stemHash(stem) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(norm(stem)));
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export const admin = {
  async students() {
    return run(sb.from('profiles').select('id, display_name, role').eq('role', 'student').order('created_at'));
  },
  async chapterHashes(chapterId) {
    const out = new Set(); let from = 0;
    for (;;) {
      const rows = await run(sb.from('questions').select('stem_hash').eq('chapter_id', chapterId).range(from, from + 999));
      rows.forEach(r => out.add(r.stem_hash)); if (rows.length < 1000) break; from += 1000;
    }
    return out;
  },
  async createBatch({ note, filename, count, userId }) {
    const rows = await run(sb.from('import_batches').insert({ note, source: 'json', source_filename: filename || null, question_count: count, created_by: userId }).select('id'));
    return rows[0].id;
  },
  async insertQuestions(rows) {
    let n = 0;
    for (let i = 0; i < rows.length; i += 100) {
      const chunk = rows.slice(i, i + 100);
      await run(sb.from('questions').insert(chunk)); n += chunk.length;
    }
    return n;
  },
  async batches(limit = 30) {
    return run(sb.from('import_batches').select('id, created_at, note, source, source_filename, question_count, status').order('created_at', { ascending: false }).limit(limit));
  },
  async rollbackBatch(batchId) {
    const qs = await run(sb.from('questions').select('id').eq('import_batch_id', batchId));
    const ids = qs.map(q => q.id);
    let used = new Set();
    for (let i = 0; i < ids.length; i += 200) {
      const rows = await run(sb.from('attempt_questions').select('question_id').in('question_id', ids.slice(i, i + 200)));
      rows.forEach(r => used.add(r.question_id));
    }
    const unused = ids.filter(id => !used.has(id));
    for (let i = 0; i < unused.length; i += 200) await run(sb.from('questions').delete().in('id', unused.slice(i, i + 200)));
    if (used.size) await run(sb.from('questions').update({ is_active: false }).in('id', [...used]));
    await run(sb.from('import_batches').update({ status: 'rolled_back' }).eq('id', batchId));
    return { deleted: unused.length, deactivated: used.size };
  },
  async questions({ chapterId, status = 'all', search = '', flagged = false, page = 0, size = 40 }) {
    let q = sb.from('questions').select('id, chapter_id, stem, options, answer_key, explanation, hints, context, context_id, difficulty, is_active, source, qc_tier, qc_flags, lesson_anchor, lock_options, image_path, updated_at', { count: 'exact' });
    if (chapterId) q = q.eq('chapter_id', chapterId);
    if (status === 'active') q = q.eq('is_active', true);
    if (status === 'inactive') q = q.eq('is_active', false);
    if (flagged) q = q.neq('qc_flags', '{}');
    if (search) q = q.ilike('stem', `%${search.replace(/[%_]/g, m => '\\' + m)}%`);
    q = q.order('created_at', { ascending: true }).range(page * size, page * size + size - 1);
    let res; try { res = await q; } catch (e) { throw toAppError(e); }
    if (res.error) throw toAppError(res.error);
    return { rows: res.data, count: res.count };
  },
  async questionStats(ids) {
    if (!ids.length) return {};
    const rows = await run(sb.from('v_question_stats').select('question_id, times_answered, times_wrong, wrong_rate, times_hinted, choice_dist').in('question_id', ids));
    return Object.fromEntries(rows.map(r => [r.question_id, r]));
  },
  async mostMissed({ chapterId = null, minAnswered = 3, limit = 25 } = {}) {
    let q = sb.from('v_question_stats').select('question_id, chapter_id, times_answered, times_wrong, wrong_rate, times_hinted').gte('times_answered', minAnswered);
    if (chapterId) q = q.eq('chapter_id', chapterId);
    return run(q.order('wrong_rate', { ascending: false }).order('times_answered', { ascending: false }).limit(limit));
  },
  async questionsByIds(ids) {
    if (!ids.length) return [];
    return run(sb.from('questions').select('id, chapter_id, stem, options, answer_key, explanation, hints, context, context_id, difficulty, is_active, source, qc_tier, qc_flags, lesson_anchor, lock_options, image_path').in('id', ids));
  },
  async usageCount(questionId) {
    const res = await sb.from('attempt_questions').select('question_id', { count: 'exact', head: true }).eq('question_id', questionId);
    if (res.error) throw toAppError(res.error);
    return res.count || 0;
  },
  async updateQuestion(id, patch) { return run(sb.from('questions').update(patch).eq('id', id).select('id')); },
  async deleteQuestion(id) { return run(sb.from('questions').delete().eq('id', id)); },
  async regrade(id) { return run(sb.rpc('regrade_question', { p_question: id })); },
  async flagCounts() {
    // inactive questions grouped by QC flag (needs-review queue)
    const out = {}; let from = 0;
    for (;;) {
      const rows = await run(sb.from('questions').select('qc_flags').eq('is_active', false).range(from, from + 999));
      rows.forEach(r => { const fl = r.qc_flags?.length ? r.qc_flags : ['(no flag)']; fl.forEach(f => { out[f] = (out[f] || 0) + 1; }); });
      if (rows.length < 1000) break; from += 1000;
    }
    return out;
  },
  async inactiveByFlag(flag, limit = 40) {
    let q = sb.from('questions').select('id, chapter_id, stem, options, answer_key, explanation, hints, context, context_id, difficulty, is_active, source, qc_tier, qc_flags, lesson_anchor, lock_options, image_path').eq('is_active', false);
    q = flag === '(no flag)' ? q.eq('qc_flags', '{}') : q.contains('qc_flags', [flag]);
    return run(q.limit(limit));
  },
  async studentAttempts(studentId, limit = 60) {
    return run(sb.from('attempts').select('id, status, chapter_ids, total_questions, answered_count, correct_count, score, started_at, finished_at, duration_s, xp_earned')
      .eq('user_id', studentId).eq('is_preview', false).order('started_at', { ascending: false }).limit(limit));
  },
  async studentProgress(studentId) {
    const rows = await run(sb.from('user_progress').select('xp_total, current_streak, best_streak, last_completed_date').eq('user_id', studentId).limit(1));
    return rows[0] || { xp_total: 0, current_streak: 0, best_streak: 0, last_completed_date: null };
  },
  async studentChapterStats(studentId) {
    return run(sb.from('v_chapter_stats').select('chapter_id, answered, accuracy_all, accuracy_recent, hint_rate_recent, last_practiced_at').eq('user_id', studentId));
  },
  async goals(studentId) {
    return run(sb.from('goals').select('*').eq('student_id', studentId).order('created_at', { ascending: false }));
  },
  async addGoal(row) { return run(sb.from('goals').insert(row).select('id')); },
  async setGoalActive(id, on) { return run(sb.from('goals').update({ is_active: on }).eq('id', id)); },
};

/* student side: active goals ("Today's mission from Dad") */
export async function myGoals(userId) {
  try { return await run(sb.from('goals').select('*').eq('student_id', userId).eq('is_active', true)); } catch { return []; }
}
