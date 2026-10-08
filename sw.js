// Service worker: caches the app shell only. Never caches *.supabase.co responses (CLAUDE.md rule 5).
const VERSION = 'mls-v1.5.1';
const KEEP = ['mls-lessons']; // per-user lesson pictures (cleared on sign-out by the app)
const SHELL = [
  './', './index.html', './manifest.json',
  './css/fonts.css', './css/tokens.css', './css/app.css',
  './js/main.js', './js/router.js', './js/supabase.js', './js/store.js', './js/state.js', './js/ui.js', './js/auth.js',
  './js/features/home.js', './js/features/pick.js', './js/features/quiz.js', './js/features/result.js', './js/features/history.js', './js/features/progress.js', './js/goals.js', './js/lesson-md.js', './js/features/learn.js',
  './js/features/admin/index.js', './js/features/admin/common.js', './js/features/admin/import.js', './js/features/admin/questions.js', './js/features/admin/review.js', './js/features/admin/student.js', './js/features/admin/goals.js', './js/features/admin/lessons.js',
  './vendor/supabase.js',
  './fonts/lilita-one-latin-400-normal.woff2', './fonts/lilita-one-latin-ext-400-normal.woff2',
  './fonts/nunito-latin-500-normal.woff2', './fonts/nunito-latin-700-normal.woff2', './fonts/nunito-latin-800-normal.woff2', './fonts/nunito-latin-900-normal.woff2',
  './fonts/nunito-latin-ext-500-normal.woff2', './fonts/nunito-latin-ext-700-normal.woff2', './fonts/nunito-latin-ext-800-normal.woff2', './fonts/nunito-latin-ext-900-normal.woff2',
  './fonts/nunito-latin-700-italic.woff2', './fonts/amiri-quran-arabic-400-normal.woff2',
  './icons/favicon.svg', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))).then(() => self.skipWaiting())); // 'reload' bypasses the HTTP cache so a release never installs stale files
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== VERSION && !KEEP.includes(k)).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== self.location.origin) return; // Supabase & everything cross-origin: network only
  if (req.mode === 'navigate') {
    // network-first so a new release shows up; cached shell when offline
    e.respondWith(fetch(req).then(res => { const copy = res.clone(); caches.open(VERSION).then(c => c.put('./index.html', copy)); return res; })
      .catch(() => caches.match('./index.html')));
    return;
  }
  // stale-while-revalidate for static files
  e.respondWith(caches.match(req).then(hit => {
    const net = fetch(req, { cache: 'no-cache' }).then(res => { if (res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); } return res; }).catch(() => hit);
    return hit || net;
  }));
});
