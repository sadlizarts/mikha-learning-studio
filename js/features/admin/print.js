// Admin → Cetak PDF (v3.8.0): Dad picks chapters + how many questions and gets a print-ready worksheet:
// question pages first, then the answer key and worked explanations on their own pages.
// "Print" uses the browser's own Save as PDF, so there is no library to load and nothing leaves the device.
import { rich, $, $$, esc, toast, shortCode } from '../../ui.js';
import { admin, imageUrl } from '../../store.js';
import { catalog } from '../../state.js';

const P = { subjectId: '', chapters: new Set(), n: 30, diff: 'all', key: true, set: null };
const COUNTS = [10, 20, 30, 40, 50];
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

export async function renderPrint(body) {
  const cat = await catalog();
  const subs = cat.subjects.filter(s => cat.chapters.some(c => c.subject_id === s.id && c.active_questions > 0));
  if (!P.subjectId || !subs.some(s => s.id === P.subjectId)) { P.subjectId = subs[0]?.id || ''; P.chapters = new Set(); }
  const chs = cat.chapters.filter(c => c.subject_id === P.subjectId && c.active_questions > 0);
  const avail = chs.filter(c => P.chapters.has(c.chapter_id)).reduce((s, c) => s + c.active_questions, 0);
  body.innerHTML = `<div class="stack pr-wrap">
    <div class="panel pr-form">
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
      <header class="ph"><div><div class="ph-t">Latihan ${esc(s.subject)}</div><div class="ph-s">${esc(s.chNames.join(' · '))}</div></div><div class="ph-brand">Mikha Learning Studio</div></header>
      <div class="ph-meta"><span>Nama: ______________________</span><span>Tanggal: ${esc(s.date)}</span><span>Nilai: ______ / ${s.qs.length}</span></div>
      <p class="ph-how">Pilih satu jawaban yang paling tepat (A, B, C, atau D).${s.short ? ` Catatan: hanya ${s.qs.length} soal tersedia dari ${s.short} yang diminta.` : ''}</p>
      ${qHtml}
    </section>
    ${keyHtml}
  </div>`;
}

/** copy the sheet into #printroot (outside #app) and print once the pictures have loaded */
async function doPrint() {
  const src = $('#pdoc'); if (!src) return;
  let root = document.getElementById('printroot');
  if (!root) { root = document.createElement('div'); root.id = 'printroot'; document.body.appendChild(root); }
  root.innerHTML = src.outerHTML.replace('id="pdoc"', '');
  await Promise.all([...root.querySelectorAll('img')].map(im => im.complete ? null : new Promise(r => { im.onload = im.onerror = r; setTimeout(r, 6000); })));
  const clear = () => { root.innerHTML = ''; window.removeEventListener('afterprint', clear); };
  window.addEventListener('afterprint', clear);
  window.print();
}
