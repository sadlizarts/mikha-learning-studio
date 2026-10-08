// Lesson Markdown (PRD Lampiran E): parse + validate + render. Used by the Learn reader and the admin preview,
// so what Dad previews is exactly what Mikha sees. Output HTML is built from escaped text only (no raw HTML allowed in).
import { esc } from './ui.js';

const ANCHOR_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** inline: **bold**, *em*, `code`. Input is raw text; output is safe HTML. */
export function inline(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
    .replace(/\*(?![\s*])([^*]*?[^\s*])\*/g, '<em>$1</em>');
}

function parseFrontmatter(lines) {
  const meta = {};
  if (lines[0]?.trim() !== '---') return { meta, rest: lines, ok: false };
  let i = 1;
  for (; i < lines.length && lines[i].trim() !== '---'; i++) {
    const m = lines[i].match(/^([A-Za-z_]+)\s*:\s*(.*)$/);
    if (m) meta[m[1].toLowerCase()] = m[2].trim();
  }
  if (i >= lines.length) return { meta, rest: lines, ok: false };
  return { meta, rest: lines.slice(i + 1), ok: true };
}

const splitRow = (l) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());

/**
 * parseLesson(md) → { meta, greeting, sections[], quick[], anchors[], titles{}, images[], errors[], warnings[], words }
 * Each section: { title, anchor, blocks[] } where block = {t:'p'|'table'|'img'|'nib'|'trap'|'kw'|'ul'|'h3'|'dalil', ...}
 * catatan (Agama): "> catatan: **Mazhab Syafi'i.** …" → a note beside the book's main text (blue box).
 * dalil (Agama): "> dalil: Q.S. an-Nisā’/4: 59" then "> arab: …", "> latin: …", "> arti: …" lines → Arabic shown right-to-left.
 */
export function parseLesson(md, { page = false } = {}) {
  const errors = [], warnings = [];
  const src = String(md || '').replace(/\r\n?/g, '\n').replace(/^﻿/, '');
  const { meta, rest, ok } = parseFrontmatter(src.split('\n'));
  if (!ok) errors.push(page ? 'Frontmatter missing: the file must start with --- … --- (page, title).' : 'Frontmatter missing: the file must start with --- … --- (subject, chapter, language).');
  for (const k of (page ? ['page', 'title'] : ['subject', 'chapter', 'language'])) if (ok && !meta[k]) errors.push(`Frontmatter needs "${k}".`);
  if (page && meta.page && !ANCHOR_RE.test(meta.page)) errors.push('page must be lower-case letters, numbers and hyphens.');
  if (meta.language && !['en', 'id'].includes(meta.language)) errors.push('language must be en or id.');

  // pull out fenced code blocks first (only the Quick check JSON is allowed)
  const lines = [];
  const fences = [];
  for (let i = 0; i < rest.length; i++) {
    if (/^```/.test(rest[i].trim())) {
      const lang = rest[i].trim().slice(3).trim();
      const buf = []; i++;
      while (i < rest.length && !/^```/.test(rest[i].trim())) buf.push(rest[i++]);
      if (i >= rest.length) errors.push('A ``` code block is not closed.');
      fences.push({ lang, text: buf.join('\n'), at: lines.length });
      lines.push(`\u0000FENCE${fences.length - 1}`);
    } else lines.push(rest[i]);
  }

  // raw HTML is not allowed (Lampiran E)
  lines.forEach((l, n) => { if (/<\/?[a-zA-Z!][^>]*>/.test(l)) errors.push(`Raw HTML is not allowed (line ${n + 1}: ${l.trim().slice(0, 40)}…).`); });

  const sections = [];
  const intro = [];
  let greeting = null, cur = null, quick = null, inQuick = false;
  const anchors = [], titles = {}, images = [];
  let para = [];
  const flush = () => { if (para.length && cur) cur.blocks.push({ t: 'p', text: para.join(' ') }); para = []; };
  const addAnchor = (a, title, n) => {
    if (!a) { errors.push(`Heading "${title}" needs an anchor like {#my-anchor}.`); return; }
    if (!ANCHOR_RE.test(a)) errors.push(`Anchor "${a}" must be lower-case letters, numbers and hyphens.`);
    if (anchors.includes(a)) errors.push(`Anchor "${a}" is used twice.`);
    anchors.push(a); titles[a] = title.replace(/^\d+\.\s*/, '');
  };

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const t = l.trim();
    if (!t) { flush(); continue; }
    let m;
    // pages are flat: anything before the first heading goes into an implicit first section named after the page
    if (page && !cur && !/^##/.test(t) && !/^#\s/.test(t)) {
      cur = { title: meta.title || 'Intro', anchor: meta.page || 'intro', blocks: [] }; addAnchor(cur.anchor, cur.title); sections.push(cur);
    }
    if ((m = t.match(/^##\s+(.+?)\s*$/)) && !t.startsWith('###')) {
      flush();
      const h = m[1];
      if (/^quick check$/i.test(h)) { inQuick = true; cur = null; continue; }
      inQuick = false;
      const am = h.match(/^(.*?)\s*\{#([^}]*)\}\s*$/);
      const title = (am ? am[1] : h).trim();
      cur = { title, anchor: am ? am[2].trim() : null, blocks: [] };
      addAnchor(cur.anchor, title);
      sections.push(cur);
      continue;
    }
    if (inQuick) {
      const f = t.match(/^\u0000FENCE(\d+)$/);
      if (f) {
        try { quick = JSON.parse(fences[+f[1]].text); } catch (e) { errors.push('Quick check JSON is not valid: ' + e.message); }
      }
      continue;
    }
    if (/^\u0000FENCE/.test(t)) { errors.push('Code blocks are only allowed under "## Quick check".'); continue; }
    if ((m = t.match(/^###\s+(.+?)\s*$/))) {
      flush();
      if (!cur && page) {   // pages are flat: every ### is its own section
        const am = m[1].match(/^(.*?)\s*\{#([^}]*)\}\s*$/); const title = (am ? am[1] : m[1]).trim();
        cur = { title, anchor: am ? am[2].trim() : null, blocks: [] }; addAnchor(cur.anchor, title); sections.push(cur); continue;
      }
      if (!cur) { errors.push(`"${t}" appears before the first ## section.`); continue; }
      if (page) { const am = m[1].match(/^(.*?)\s*\{#([^}]*)\}\s*$/); const title = (am ? am[1] : m[1]).trim();
        cur = { title, anchor: am ? am[2].trim() : null, blocks: [] }; addAnchor(cur.anchor, title); sections.push(cur); continue; }
      const am = m[1].match(/^(.*?)\s*\{#([^}]*)\}\s*$/);
      const title = (am ? am[1] : m[1]).trim();
      const a = am ? am[2].trim() : null;
      if (a) addAnchor(a, title);
      cur.blocks.push({ t: 'h3', title, anchor: a });
      continue;
    }
    if ((m = t.match(/^>\s*dalil\s*:\s*(.*)$/i))) {
      flush();
      const d = { t: 'dalil', ref: m[1].trim(), arab: '', latin: '', arti: '' };
      let last = null;
      while (i + 1 < lines.length && /^>/.test(lines[i + 1].trim()) && !/^>\s*(nib|trap|dalil|catatan)\s*:/i.test(lines[i + 1].trim())) {
        const x = lines[++i].trim().replace(/^>\s?/, '');
        const km = x.match(/^(arab|latin|arti)\s*:\s*(.*)$/i);
        if (km) { last = km[1].toLowerCase(); d[last] = km[2].trim(); }
        else if (last && x.trim()) d[last] += ' ' + x.trim();
      }
      if (!d.ref) errors.push('A "> dalil:" block needs a reference, e.g. "> dalil: Q.S. an-Nisā’/4: 59".');
      if (!d.arab && !d.arti) errors.push(`Dalil "${d.ref}": add "> arab:" and/or "> arti:" lines.`);
      if (d.arab && (/[A-Za-z]/.test(d.arab) || !/[\u0600-\u06FF]/.test(d.arab))) errors.push(`Dalil "${d.ref}": "> arab:" must be Arabic script only.`);
      if (/\{\{/.test(d.arab + d.arti)) errors.push(`Dalil "${d.ref}": unresolved {{…}} placeholder.`);
      if (!cur) warnings.push('A dalil before the first section was ignored.'); else cur.blocks.push(d);
      continue;
    }
    if ((m = t.match(/^>\s*(nib|trap|catatan)\s*:\s*(.*)$/i))) {
      flush();
      let text = m[2];
      while (i + 1 < lines.length && /^>/.test(lines[i + 1].trim()) && !/^>\s*(nib|trap|dalil|catatan)\s*:/i.test(lines[i + 1].trim())) text += ' ' + lines[++i].trim().replace(/^>\s?/, '');
      const kind = m[1].toLowerCase();
      if (!cur) { if (kind === 'nib' && !greeting) greeting = text; else warnings.push('A callout before the first section was ignored.'); continue; }
      cur.blocks.push({ t: kind, text });
      continue;
    }
    if (/^>/.test(t)) { flush(); warnings.push(`Plain quote shown as a paragraph: "${t.slice(0, 40)}…" (use "> nib:", "> trap:", "> catatan:" or "> dalil:").`); if (cur) cur.blocks.push({ t: 'p', text: t.replace(/^>\s?/, '') }); continue; }
    if ((m = t.match(/^::keywords\s+(.+)$/i))) {
      flush(); if (cur) cur.blocks.push({ t: 'kw', words: m[1].split(/\s*·\s*|\s*,\s*/).map(s => s.trim()).filter(Boolean) });
      continue;
    }
    if ((m = t.match(/^!\[([^\]]*)\]\(([^)]+)\)$/))) {
      flush();
      const s = m[2].trim();
      const sm = s.match(/^storage:([A-Za-z0-9._-]+\.(svg|webp|png|jpe?g))$/i);
      if (!sm) { errors.push(`Image "${s}" must be storage:<file>.svg/.webp (no outside links).`); continue; }
      if (!m[1].trim()) warnings.push(`Image ${sm[1]} has no description (alt text).`);
      images.push(sm[1]);
      if (cur) cur.blocks.push({ t: 'img', name: sm[1], alt: m[1].trim() });
      continue;
    }
    if (/^\|/.test(t)) {
      flush();
      const rows = [];
      while (i < lines.length && /^\|/.test(lines[i].trim())) rows.push(lines[i++].trim());
      i--;
      const sep = rows.findIndex(r => /^\|?\s*:?-{2,}/.test(r.replace(/\|/g, '|')) && /^[|\s:-]+$/.test(r));
      const head = sep === 1 ? splitRow(rows[0]) : null;
      const body = rows.filter((_, k) => k !== sep && !(head && k === 0)).map(splitRow);
      if (cur) cur.blocks.push({ t: 'table', head, body });
      continue;
    }
    if ((m = t.match(/^[-*]\s+(.+)$/))) {
      flush();
      const items = [m[1]];
      while (i + 1 < lines.length && /^[-*]\s+/.test(lines[i + 1].trim())) items.push(lines[++i].trim().replace(/^[-*]\s+/, ''));
      if (cur) cur.blocks.push({ t: 'ul', items });
      continue;
    }
    if ((m = t.match(/^\d+[.)]\s+(.+)$/))) {
      flush();
      const items = [m[1]];
      while (i + 1 < lines.length && /^\d+[.)]\s+/.test(lines[i + 1].trim())) items.push(lines[++i].trim().replace(/^\d+[.)]\s+/, ''));
      if (cur) cur.blocks.push({ t: 'ol', items });
      continue;
    }
    if (/^#\s/.test(t)) { warnings.push(`"# ${t.slice(2, 30)}" (single #) is ignored; the title comes from the chapter.`); continue; }
    if (!cur) {
      if (!greeting) warnings.push('Text before the first ## section is ignored (only a "> nib:" greeting is shown there).'); continue;
    }
    para.push(t);
  }
  flush();

  // quick check (FR-58: 3–5 questions, A.1 format without hints/image)
  const qc = [];
  if (quick === null) { if (!page) errors.push('"## Quick check" with a ```json block of 3–5 questions is missing.'); }
  else if (!Array.isArray(quick)) errors.push('Quick check must be a JSON array.');
  else {
    if (quick.length < 3 || quick.length > 5) errors.push(`Quick check has ${quick.length} questions (needs 3–5).`);
    quick.forEach((q, k) => {
      const n = `Quick check ${k + 1}`;
      const opts = q?.options || {};
      const vals = ['A', 'B', 'C', 'D'].map(x => String(opts[x] ?? '').trim());
      if (!String(q?.stem || '').trim()) errors.push(`${n}: stem missing.`);
      if (vals.some(v => !v)) errors.push(`${n}: needs options A, B, C and D.`);
      if (!['A', 'B', 'C', 'D'].includes(String(q?.answer || '').trim().toUpperCase())) errors.push(`${n}: answer must be A–D.`);
      if (!String(q?.explanation || '').trim()) errors.push(`${n}: explanation missing.`);
      if (q?.hints?.length || q?.image) warnings.push(`${n}: hints/image are ignored in a Quick check.`);
      qc.push({ stem: String(q?.stem || '').trim(), options: Object.fromEntries(['A', 'B', 'C', 'D'].map((x, j) => [x, vals[j]])), answer: String(q?.answer || '').trim().toUpperCase(), explanation: String(q?.explanation || '').trim() });
    });
  }

  // structure checks (E.2) — warnings, not blockers
  const all = sections.flatMap(s => s.blocks);
  if (!page) {
    if (sections.length < 3 || sections.length > 6) warnings.push(`${sections.length} sections (style guide: 3–6).`);
    if (!all.some(b => b.t === 'table')) warnings.push('No recap table (style guide: 1).');
    if (all.filter(b => b.t === 'trap').length < 2) warnings.push('Fewer than 2 Trap! callouts (style guide: ≥ 2).');
    if (!greeting && !all.some(b => b.t === 'nib')) warnings.push('No "Nib says" callout (style guide: ≥ 1).');
    if (!all.some(b => b.t === 'kw')) warnings.push('No ::keywords line.');
  }
  if (page && !sections.length) errors.push('A page needs at least one "### Title {#anchor}" or "## Title {#anchor}" section.');
  // frontmatter "anchors:" must match the headings (questions use these names)
  if (meta.anchors) {
    const listed = meta.anchors.split(/[,\s]+/).filter(Boolean);
    const missing = listed.filter(a => !anchors.includes(a));
    if (missing.length) errors.push(`Frontmatter lists anchor(s) with no heading: ${missing.join(', ')}. Add "## … {#${missing[0]}}" or "### … {#${missing[0]}}".`);
  }
  const words = intro.join(' ').split(/\s+/).filter(Boolean).length + all.reduce((n, b) => n + ((b.text || b.arti || '') + ' ' + (b.items || []).join(' ') + ' ' + (b.body || []).flat().join(' ')).split(/\s+/).filter(Boolean).length, 0);
  const readMinutes = +meta.read_minutes || Math.max(3, Math.round(words / 160));
  return { meta, greeting, intro: intro.join(' '), sections, quick: qc, anchors, titles, images: [...new Set(images)], errors, warnings, words, readMinutes };
}

/** anchor slug → readable label when the lesson body is not loaded (quiz "Read:" button) */
export const anchorLabel = (a) => { const s = String(a || '').replace(/-/g, ' '); return s.charAt(0).toUpperCase() + s.slice(1); };

/** Render sections to HTML. img(name) returns a URL or null (null → placeholder box). */
export function renderSections(p, img = () => null) {
  const block = (b) => {
    switch (b.t) {
      case 'p': return `<p>${inline(b.text)}</p>`;
      case 'h3': return `<h4 class="lsub"${b.anchor ? ` id="l-${esc(b.anchor)}" data-anchor="${esc(b.anchor)}"` : ''}>${inline(b.title)}</h4>`;
      case 'nib': return `<div class="callout nib"><b>Nib says:</b> ${inline(b.text)}</div>`;
      case 'trap': return `<div class="callout trap"><b>Trap!</b> ${inline(b.text)}</div>`;
      case 'catatan': return `<div class="callout alt"><b>Catatan:</b> ${inline(b.text)}</div>`;
      case 'dalil': return `<figure class="dalil">${b.arab ? `<p class="arab" dir="rtl" lang="ar">${esc(b.arab)}</p>` : ''}${b.latin ? `<p class="latin">${inline(b.latin)}</p>` : ''}${b.arti ? `<p class="arti">${inline(b.arti)}</p>` : ''}<figcaption>${inline(b.ref)}</figcaption></figure>`;
      case 'kw': return `<div class="keyrow" aria-label="Key words">${b.words.map(w => `<span class="kw">${esc(w)}</span>`).join('')}</div>`;
      case 'ul': return `<ul class="lul">${b.items.map(x => `<li>${inline(x)}</li>`).join('')}</ul>`;
      case 'ol': return `<ol class="lul lol">${b.items.map(x => `<li>${inline(x)}</li>`).join('')}</ol>`;
      case 'table': return `<div class="recap" tabindex="0"><table>${b.head ? `<thead><tr>${b.head.map(c => `<th>${inline(c)}</th>`).join('')}</tr></thead>` : ''}<tbody>${b.body.map(r => `<tr>${r.map(c => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
      case 'img': {
        const u = img(b.name);
        return `<figure class="limg" data-img="${esc(b.name)}">${u ? `<img src="${esc(u)}" alt="${esc(b.alt)}" loading="lazy">` : `<div class="ph">${esc(b.alt || b.name)}</div>`}${b.alt ? `<figcaption>${esc(b.alt)}</figcaption>` : ''}</figure>`;
      }
      default: return '';
    }
  };
  return p.sections.map(s => `<section class="lsec" id="l-${esc(s.anchor || '')}" data-anchor="${esc(s.anchor || '')}"><h3>${inline(s.title)}</h3>${s.blocks.map(block).join('')}</section>`).join('');
}
