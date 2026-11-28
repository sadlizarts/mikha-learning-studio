// Admin → Cetak PDF (v3.8.0): Dad picks chapters + how many questions and gets a print-ready worksheet:
// question pages first, then the answer key and worked explanations on their own pages.
// "Print" uses the browser's own Save as PDF, so there is no library to load and nothing leaves the device.
import { rich, $, $$, esc, toast, shortCode } from '../../ui.js';
import { admin, imageUrl } from '../../store.js';
import { catalog } from '../../state.js';

const P = { subjectId: '', chapters: new Set(), n: 30, diff: 'all', key: true, set: null };
// v3.9.0 exam practice (kisi-kisi): mode 'exam' | 'free'
const X = { mode: 'exam', bpId: '', bps: null, set: null, printedId: null, info: null };
const COUNTS = [10, 20, 30, 40, 50];
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

export async function renderPrint(body) {
  const cat = await catalog();
  if (X.bps === null) { try { X.bps = await admin.blueprints(); } catch { X.bps = []; } }
  if (!X.bps.length) X.mode = 'free';
  const seg = X.bps.length ? `<div class="pr-seg" role="tablist">
      <button class="${X.mode === 'exam' ? 'on' : ''}" data-mode="exam">Latihan ujian (kisi-kisi)</button>
      <button class="${X.mode === 'free' ? 'on' : ''}" data-mode="free">Bebas (pilih bab)</button></div>` : '';
  if (X.mode === 'exam') return renderExam(body, cat, seg);
  const subs = cat.subjects.filter(s => cat.chapters.some(c => c.subject_id === s.id && c.active_questions > 0));
  if (!P.subjectId || !subs.some(s => s.id === P.subjectId)) { P.subjectId = subs[0]?.id || ''; P.chapters = new Set(); }
  const chs = cat.chapters.filter(c => c.subject_id === P.subjectId && c.active_questions > 0);
  const avail = chs.filter(c => P.chapters.has(c.chapter_id)).reduce((s, c) => s + c.active_questions, 0);
  body.innerHTML = `<div class="stack pr-wrap">
    <div class="panel pr-form">
      ${seg}
      <h3>Cetak soal ke PDF</h3>
      <p class="note" style="margin:2px 0 10px">Pilih mapel, bab, dan jumlah soal. Hasilnya lembar soal siap cetak, lalu kunci jawaban dan pembahasan di halaman terpisah.</p>
      <label class="lbl" for="pr-sub">1 · Mapel</label>
      <select id="pr-sub">${subs.map(s => `<option value="${s.id}" ${s.id === P.subjectId ? 'selected' : ''}>${esc(s.name)}</option>`).join('')}</select>
      <div class="row between" style="margin-top:12px"><span class="lbl" style="margin:0">2 · Bab</span>
        <span class="row" style="gap:6px"><button class="btn xs" id="pr-all">Semua</button><button class="btn xs ghost" id="pr-none">Kosongkan</button></span></div>
      <div class="pr-chs">${chs.map(c => `<label class="pr-ch"><input type="checkbox" value="${c.chapter_id}" ${P.chapters.has(c.chapter_id) ? 'checked' : ''}><span><b>${esc(shortCode(c.code))}</b> ${esc(c.name)} <small class="num">${c.active_questions}</small></span></label>`).join('')}</div>
      <div class="grid2" style="margin-top:12px">
        <div><label class="lbl" for="pr-n">3 · Jumlah soal</label><select id="pr-n">${COUNTS.map(n => `<option ${n === P.n ? 'selected' : ''}>${n}</option>`).join('')}</select></div>
        <div><label class="lbl" for="pr-d">Tingkat</label><select id="pr-d">${[['all', 'Campuran'], ['medium', 'Medium saja'], ['hard', 'Hard saja']].map(([v, l]) => `<option value="${v}" ${v === P.diff ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
      </div>
      <label class="row" style="margin-top:12px;gap:8px;font-weight:800;color:var(--ink)"><input type="checkbox" id="pr-key" ${P.key ? 'checked' : ''}> Sertakan kunci jawaban + pembahasan (halaman terpisah)</label>
      <div class="row" style="gap:8px;margin-top:14px;flex-wrap:wrap">
        <button class="btn primary" id="pr-make" ${P.chapters.size ? '' : 'disabled'}>${P.set ? 'Acak ulang soal' : 'Buat lembar soal'}</button>
        ${P.set ? '<button class="btn" id="pr-print">Cetak / Simpan PDF</button>' : ''}
        <span class="note num">${P.chapters.size ? `${P.chapters.size} bab · ${avail} soal tersedia` : 'Pilih minimal satu bab'}</span>
      </div>
      ${P.set ? '<p class="note" style="margin-top:8px">Di jendela cetak, pilih <b>Save as PDF</b> (atau printer). Ukuran kertas A4, margin Default.</p>' : ''}
    </div>
    <div id="pr-prev">${P.set ? sheetHtml(P.set) : '<div class="panel sunk empty">Pratinjau lembar soal muncul di sini.</div>'}</div>
  </div>`;
  const again = () => renderPrint(body);
  bindSeg(body);
  $('#pr-sub').onchange = (e) => { P.subjectId = e.target.value; P.chapters = new Set(); P.set = null; again(); };
  $$('.pr-ch input', body).forEach(i => i.onchange = () => { i.checked ? P.chapters.add(i.value) : P.chapters.delete(i.value); P.set = null; again(); });
  $('#pr-all').onclick = () => { P.chapters = new Set(chs.map(c => c.chapter_id)); P.set = null; again(); };
  $('#pr-none').onclick = () => { P.chapters = new Set(); P.set = null; again(); };
  $('#pr-n').onchange = (e) => { P.n = +e.target.value; };
  $('#pr-d').onchange = (e) => { P.diff = e.target.value; };
  $('#pr-key').onchange = (e) => { P.key = e.target.checked; if (P.set) { P.set.key = P.key; again(); } };
  $('#pr-make').onclick = async () => {
    const b = $('#pr-make'); b.disabled = true; b.textContent = 'Menyiapkan…';
    try { P.set = await build(cat); } catch (e) { toast(e.message || 'Gagal memuat soal'); }
    again();
  };
  const pb = $('#pr-print');
  if (pb) pb.onclick = () => doPrint();
}

/** pick the questions: spread evenly over the chosen chapters, passages (same context_id) stay together, options shuffled unless locked */
async function build(cat) {
  const ids = [...P.chapters];
  const rows = await admin.printQuestions(ids, P.diff);
  if (!rows.length) throw new Error('Tidak ada soal aktif untuk pilihan ini.');
  const byCh = new Map(ids.map(id => [id, []]));
  rows.forEach(r => byCh.get(r.chapter_id)?.push(r));
  byCh.forEach(list => shuffle(list));
  const picked = [];
  const order = cat.chapters.filter(c => P.chapters.has(c.chapter_id)).map(c => c.chapter_id);
  for (let round = 0; picked.length < P.n; round++) {       // round-robin so every chapter is represented
    let took = false;
    for (const id of order) { const q = byCh.get(id)[round]; if (q && picked.length < P.n) { picked.push(q); took = true; } }
    if (!took) break;
  }
  // chapter order, and questions that share a passage next to each other
  const pos = Object.fromEntries(order.map((id, i) => [id, i]));
  picked.sort((a, b) => pos[a.chapter_id] - pos[b.chapter_id] || String(a.context_id || a.id).localeCompare(String(b.context_id || b.id)));
  const qs = await Promise.all(picked.map(async (q) => {
    const letters = ['A', 'B', 'C', 'D'].filter(k => q.options?.[k] != null);
    const ord = q.lock_options ? letters : shuffle([...letters]);
    return { ...q, opts: ord.map(k => q.options[k]), keyPos: ord.indexOf(q.answer_key), img: q.image_path ? await imageUrl(q.image_path) : null };
  }));
  const sub = cat.subjects.find(s => s.id === P.subjectId);
  const chNames = cat.chapters.filter(c => P.chapters.has(c.chapter_id)).map(c => `${shortCode(c.code)} ${c.name}`);
  return { qs, subject: sub?.name || '', chNames, key: P.key, short: qs.length < P.n ? P.n : 0,
    date: new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date()) };
}

function sheetHtml(s) {
  const L = 'ABCD';
  let lastCtx = null;
  const qHtml = s.qs.map((q, i) => {
    const showCtx = q.context && (!q.context_id || q.context_id !== lastCtx);
    lastCtx = q.context_id || null;
    return `${showCtx ? `<div class="pq-ctx"><b>Bacaan${q.context_id ? ' (untuk soal-soal berikut)' : ''}</b><div>${rich(q.context)}</div></div>` : ''}
    <div class="pq"><div class="pq-n">${i + 1}.</div><div class="pq-b">
      <div class="pq-stem">${rich(q.stem)}</div>
      ${q.img ? `<img class="pq-img" src="${esc(q.img)}" alt="">` : q.image_path ? '<div class="pq-noimg">[gambar tidak termuat]</div>' : ''}
      <ol class="pq-opts">${q.opts.map((o, k) => `<li><span>${L[k]}.</span><div>${rich(o)}</div></li>`).join('')}</ol>
    </div></div>`;
  }).join('');
  const keyHtml = !s.key ? '' : `<section class="psheet pkey">
      <header class="ph"><div><div class="ph-t">Kunci jawaban</div><div class="ph-s">${esc(s.subject)} · ${s.qs.length} soal · ${esc(s.date)}</div></div><div class="ph-brand">Mikha Learning Studio</div></header>
      <div class="pk-grid">${s.qs.map((q, i) => `<span><b>${i + 1}.</b> ${L[q.keyPos] || '?'}</span>`).join('')}</div>
      <div class="ph-t" style="font-size:15px;margin:14px 0 6px">Pembahasan</div>
      ${s.qs.map((q, i) => `<div class="pk-row"><div class="pq-n">${i + 1}.</div><div class="pq-b"><b>${L[q.keyPos] || '?'}. ${rich(q.opts[q.keyPos] ?? '')}</b><div>${rich(q.explanation || '')}</div></div></div>`).join('')}
    </section>`;
  return `<div class="pdoc" id="pdoc">
    <section class="psheet">
      <header class="ph"><div><div class="ph-t">${esc(s.title || `Latihan ${s.subject}`)}</div><div class="ph-s">${esc(s.chNames.join(' · '))}</div></div><div class="ph-brand">Mikha Learning Studio</div></header>
      <div class="ph-meta"><span>Nama: ______________________</span><span>Tanggal: ${esc(s.date)}</span><span>Nilai: ______ / ${s.qs.length}</span></div>
      <p class="ph-how">Pilih satu jawaban yang paling tepat (A, B, C, atau D).${s.short ? ` Catatan: hanya ${s.qs.length} soal tersedia dari ${s.short} yang diminta.` : ''}</p>
      ${qHtml}
    </section>
    ${keyHtml}
  </div>`;
}

/** copy the sheet into #printroot (outside #app) and print once the pictures have loaded */
async function doPrint(before) {
  const src = $('#pdoc'); if (!src) return;
  if (before) { const ok = await before(); if (ok === false) return; }
  let root = document.getElementById('printroot');
  if (!root) { root = document.createElement('div'); root.id = 'printroot'; document.body.appendChild(root); }
  root.innerHTML = src.outerHTML.replace('id="pdoc"', '');
  await Promise.all([...root.querySelectorAll('img')].map(im => im.complete ? null : new Promise(r => { im.onload = im.onerror = r; setTimeout(r, 6000); })));
  const clear = () => { root.innerHTML = ''; window.removeEventListener('afterprint', clear); };
  window.addEventListener('afterprint', clear);
  window.print();
}

/* ---------------- v3.9.0 Latihan ujian (kisi-kisi) ---------------- */
function bindSeg(body) {
  $$('.pr-seg [data-mode]', body).forEach(b => b.onclick = () => { X.mode = b.dataset.mode; renderPrint(body); });
}

/** pool of the blueprint's chapter, grouped by indicator (questions.skill = K01…), with how often each was printed */
async function examPool(bp) {
  const [rows, prints] = await Promise.all([admin.printQuestions([bp.chapter_id]), admin.examPrints(bp.id)]);
  const uses = new Map();   // id -> {n, last}
  prints.forEach((pr, i) => pr.question_ids.forEach(id => { const u = uses.get(id) || { n: 0, last: -1 }; u.n++; u.last = i; uses.set(id, u); }));
  const byK = new Map(bp.items.map(it => [it.k, []]));
  rows.forEach(r => byK.get(r.skill)?.push(r));
  const fresh = bp.items.map(it => ({ it, have: byK.get(it.k).length, unused: byK.get(it.k).filter(q => !uses.has(q.id)).length }));
  const setsLeft = Math.min(...fresh.map(f => Math.floor(f.unused / f.it.n)));
  const setsTotal = Math.min(...fresh.map(f => Math.floor(f.have / f.it.n)));
  const short = fresh.filter(f => f.have < f.it.n);
  return { rows, byK, uses, prints: prints.length, setsLeft, setsTotal, short, pool: rows.length };
}

async function renderExam(body, cat, seg) {
  if (!X.bpId || !X.bps.some(b => b.id === X.bpId)) X.bpId = X.bps[0].id;
  const bp = X.bps.find(b => b.id === X.bpId);
  body.innerHTML = `<div class="stack pr-wrap"><div class="panel pr-form">${seg}<div class="spin"></div></div><div></div></div>`;
  try { X.info = await examPool(bp); } catch (e) { body.innerHTML = `<div class="panel sunk empty">${esc(e.message)}</div>`; return; }
  const I = X.info;
  const dLeft = bp.exam_date ? Math.round((Date.parse(bp.exam_date) - Date.parse(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date()))) / 864e5) : null;
  const lv = bp.items.reduce((m, it) => (m[it.level] = (m[it.level] || 0) + it.n, m), {});
  body.innerHTML = `<div class="stack pr-wrap">
    <div class="panel pr-form">
      ${seg}
      <h3>Latihan ujian sesuai kisi-kisi</h3>
      <p class="note" style="margin:2px 0 10px">Setiap set berisi ${bp.total} soal: tiap indikator kisi-kisi terwakili. Soal yang sudah pernah dicetak tidak dipakai lagi sampai stoknya habis. Urutan soal dan pilihan jawaban diacak setiap kali.</p>
      ${X.bps.length > 1 ? `<label class="lbl" for="ex-bp">Ujian</label><select id="ex-bp">${X.bps.map(b => `<option value="${b.id}" ${b.id === bp.id ? 'selected' : ''}>${esc(b.title)}</option>`).join('')}</select>` : `<div class="ex-title">${esc(bp.title)}</div>`}
      <div class="ex-stats">
        <div><b class="num">${bp.exam_date ? esc(new Intl.DateTimeFormat('id-ID', { timeZone: 'UTC', day: 'numeric', month: 'short' }).format(new Date(bp.exam_date))) : '—'}</b><span>${dLeft == null ? 'tanggal ujian' : dLeft > 0 ? `H-${dLeft}` : dLeft === 0 ? 'hari ini' : 'sudah lewat'}</span></div>
        <div><b class="num">${bp.items.length}</b><span>indikator</span></div>
        <div><b class="num">${I.pool}</b><span>soal di stok</span></div>
        <div><b class="num">${I.prints}</b><span>set sudah dicetak</span></div>
      </div>
      <p class="note num" style="margin:8px 0 0">Level per set: ${Object.entries(lv).sort().map(([k, v]) => `${k} ${v}`).join(' · ')}. ${I.setsLeft > 0 ? `Masih cukup untuk <b>${I.setsLeft} set</b> tanpa soal berulang.` : `<b style="color:var(--bad)">Stok soal baru habis</b>: set berikutnya memakai soal yang paling jarang/lama keluar.`}</p>
      ${I.short.length ? `<p class="note" style="color:var(--bad);margin-top:6px">Belum cukup soal untuk: ${I.short.map(f => esc(f.it.k)).join(', ')}.</p>` : ''}
      <label class="row" style="margin-top:12px;gap:8px;font-weight:800;color:var(--ink)"><input type="checkbox" id="pr-key" ${P.key ? 'checked' : ''}> Sertakan kunci jawaban + pembahasan (halaman terpisah)</label>
      <div class="row" style="gap:8px;margin-top:14px;flex-wrap:wrap">
        <button class="btn primary" id="ex-make" ${I.pool ? '' : 'disabled'}>${X.set ? 'Buat set lain' : 'Buat set soal'}</button>
        ${X.set ? `<button class="btn" id="ex-print">${X.printedId ? 'Cetak lagi' : 'Cetak / Simpan PDF'}</button>` : ''}
      </div>
      ${X.set ? `<p class="note" style="margin-top:8px">${X.printedId ? 'Set ini sudah tercatat sebagai dicetak.' : 'Set baru tercatat saat Anda menekan Cetak, jadi "Buat set lain" tidak menghabiskan stok.'} Di jendela cetak pilih <b>Save as PDF</b>, kertas A4.</p>` : ''}
      <details class="ex-kisi"><summary>Lihat kisi-kisi (${bp.items.length} indikator)</summary>
        <ol>${bp.items.map(it => { const h = I.byK.get(it.k).length, u = I.byK.get(it.k).filter(q => !I.uses.has(q.id)).length; return `<li><span>${esc(it.label)}</span><small class="num">${esc(it.level)} · ${it.n}×/set · ${u}/${h} baru</small></li>`; }).join('')}</ol>
      </details>
    </div>
    <div id="pr-prev">${X.set ? sheetHtml(X.set) : '<div class="panel sunk empty">Pratinjau set soal muncul di sini.</div>'}</div>
  </div>`;
  bindSeg(body);
  const again = () => renderExam(body, cat, seg);
  if ($('#ex-bp')) $('#ex-bp').onchange = (e) => { X.bpId = e.target.value; X.set = null; X.printedId = null; renderPrint(body); };
  $('#pr-key').onchange = (e) => { P.key = e.target.checked; if (X.set) { X.set.key = P.key; again(); } };
  $('#ex-make').onclick = async () => {
    const b = $('#ex-make'); b.disabled = true; b.textContent = 'Menyiapkan…';
    try { X.set = await buildExam(cat, bp, X.info); X.printedId = null; } catch (e) { toast(e.message || 'Gagal menyiapkan soal'); }
    again();
  };
  const pb = $('#ex-print');
  if (pb) pb.onclick = () => doPrint(async () => {
    if (X.printedId) return true;
    try { X.printedId = await admin.addExamPrint(bp.id, X.set.qs.map(q => q.id)); }
    catch (e) { toast('Set belum tercatat: ' + (e.message || 'error')); }
    setTimeout(() => { if (X.mode === 'exam') again(); }, 800);   // refresh stock counts after the print dialog
    return true;
  });
}

/** pick per indicator: never-printed first (random), then least-printed / printed longest ago; then shuffle everything */
async function buildExam(cat, bp, I) {
  const picked = [];
  let reused = 0;
  for (const it of bp.items) {
    const list = shuffle([...I.byK.get(it.k)]);
    list.sort((a, b) => { const ua = I.uses.get(a.id), ub = I.uses.get(b.id); return (ua?.n || 0) - (ub?.n || 0) || (ua?.last ?? -1) - (ub?.last ?? -1); });
    const take = list.slice(0, it.n);
    reused += take.filter(q => I.uses.has(q.id)).length;
    picked.push(...take);
  }
  if (!picked.length) throw new Error('Belum ada soal untuk kisi-kisi ini.');
  shuffle(picked);
  // questions that share a passage stay next to each other
  const firstPos = new Map(); picked.forEach((q, i) => { if (q.context_id && !firstPos.has(q.context_id)) firstPos.set(q.context_id, i); });
  picked.sort((a, b) => (a.context_id ? firstPos.get(a.context_id) : picked.indexOf(a)) - (b.context_id ? firstPos.get(b.context_id) : picked.indexOf(b)));
  const qs = await Promise.all(picked.map(async (q) => {
    const letters = ['A', 'B', 'C', 'D'].filter(k => q.options?.[k] != null);
    const ord = q.lock_options ? letters : shuffle([...letters]);
    return { ...q, opts: ord.map(k => q.options[k]), keyPos: ord.indexOf(q.answer_key), img: q.image_path ? await imageUrl(q.image_path) : null };
  }));
  const sub = cat.subjects.find(s => s.id === bp.subject_id);
  const setNo = I.prints + 1;
  return { qs, subject: sub?.name || '', key: P.key, short: qs.length < bp.total ? bp.total : 0,
    title: `${bp.title} — Set ${setNo}`,
    chNames: [`${qs.length} soal sesuai kisi-kisi${bp.exam_date ? ' · ujian ' + new Intl.DateTimeFormat('id-ID', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(bp.exam_date)) : ''}${reused ? ` · ${reused} soal pernah keluar` : ''}`],
    date: new Intl.DateTimeFormat('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'long', year: 'numeric' }).format(new Date()) };
}
