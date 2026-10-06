# Mikha Learning Studio

A small practice-quiz PWA for one Grade 7 student. Static site (GitHub Pages) + Supabase (Auth, Postgres with RLS, RPC functions).

- No build step: plain HTML, CSS and ES modules. `vendor/supabase.js` is a bundled copy of `@supabase/supabase-js` 2.117.2.
- Only the project URL and the **publishable** key are in `js/supabase.js`; all data is protected by row-level security, and every write goes through security-definer RPCs.
- Fonts (Lilita One, Nunito — SIL OFL) are vendored in `fonts/` so the app works offline.
- The mascot "Nib" and all graphics are original.

Version 1.0.0 — Phase 0–1: sign in, Home (streak, XP/level, continue), Pick chapters, Practice with hints and instant feedback, Result with review, History, first slice of Progress.
