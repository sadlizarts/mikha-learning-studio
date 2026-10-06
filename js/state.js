// In-memory app state shared by the screens. Server stays the source of truth.
import { loadCatalog, loadProfile } from './store.js';

export const app = {
  session: null,
  user: null,
  profile: null,
  catalog: null,       // { subjects, chapters, statBy }
  catalogAt: 0,
};

export async function setSession(session) {
  app.session = session;
  app.user = session?.user || null;
  app.profile = app.user ? await loadProfile(app.user.id) : null;
  app.catalog = null;
}

/** Catalog is cached for 60 s; pass force=true after a practice so accuracy is fresh. */
export async function catalog(force = false) {
  if (!app.catalog || force || Date.now() - app.catalogAt > 60000) {
    app.catalog = await loadCatalog(app.user.id);
    app.catalogAt = Date.now();
  }
  return app.catalog;
}

export function chapterIndex(cat) {
  const subj = Object.fromEntries(cat.subjects.map(s => [s.id, s]));
  return Object.fromEntries(cat.chapters.map(c => [c.chapter_id, { ...c, subject: subj[c.subject_id] }]));
}

export const firstName = () => (app.profile?.display_name || 'Mikha').split(' ')[0];
