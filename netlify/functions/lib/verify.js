'use strict';
// Checks an AI explanation against the passages that were actually retrieved.
// Returns { ok: true } or { ok: false, reason }.
const bible = require('./bible');
const clean = (s) => bible.norm(s).replace(/[^a-z0-9'\s]/g, ' ').replace(/\s+/g, ' ').trim();

function verifyExplanation(text, passages) {
  if (!text || text.length < 20) return { ok: false, reason: 'empty answer' };

  // 1. Every double-quoted span must be an exact piece of the retrieved text (… splits a quote into pieces).
  const hay = ' ' + clean(passages.map((p) => p.verses.map((v) => v.text).join(' ')).join(' ')) + ' ';
  const spans = [...text.matchAll(/"([^"]+)"|\u201C([^\u201D]+)\u201D/g)].map((m) => m[1] || m[2]);
  for (const s of spans) {
    for (const part of s.split(/\u2026|\.{3}/)) {
      const c = clean(part);
      if (c && !hay.includes(' ' + c + ' ')) return { ok: false, reason: 'a quotation is not exact KJV text: ' + part.slice(0, 60) };
    }
  }

  // 2. No references to anything outside the retrieved passages.
  const allowed = new Map();
  const verseNums = new Set(), chapters = new Set();
  for (const p of passages) {
    allowed.set(p.book + '|' + p.chapter, new Set(p.verses.map((v) => v.n)));
    p.verses.forEach((v) => verseNums.add(v.n));
    chapters.add(p.chapter);
  }
  const mentions = bible.parseReferences(text);
  if (mentions.unrecognized.length) return { ok: false, reason: 'unrecognized reference ' + mentions.unrecognized[0] };
  for (const f of mentions.found) {
    const set = allowed.get(f.book + '|' + f.chapter);
    if (!set) return { ok: false, reason: 'cites a passage that was not retrieved: ' + f.label };
    if (f.ranges) for (const [a, b] of f.ranges) for (let v = a; v <= b; v++) if (!set.has(v)) return { ok: false, reason: 'cites a verse that was not retrieved: ' + f.label };
  }
  const t = bible.norm(text);
  for (const m of t.matchAll(/\b(?:verses?|vv|vs|versos?|versiculos?)\.?\s*(\d{1,3})(?:\s*(?:-|to|through|and|y|a|al)\s*(\d{1,3}))?/g)) {
    for (const n of [m[1], m[2]].filter(Boolean)) if (!verseNums.has(Number(n))) return { ok: false, reason: 'mentions verse ' + n + ' which was not retrieved' };
  }
  for (const m of t.matchAll(/\bchapters?\s*(\d{1,3})/g)) if (!chapters.has(Number(m[1]))) return { ok: false, reason: 'mentions chapter ' + m[1] + ' which was not retrieved' };

  // 3. No unverified original-language or historical material.
  if (/[\u0370-\u03FF\u1F00-\u1FFF\u0590-\u05FF]/.test(text)) return { ok: false, reason: 'contains Hebrew or Greek script' };
  if (/\b(hebrew|greek|aramaic|hebreo|griego|arameo|septuagint|strong'?s|etymolog\w*|original (language|text|manuscripts?|hebrew|greek)|idioma original|texto original)\b/.test(t)) return { ok: false, reason: 'mentions original-language material' };
  if (/\b\d{1,4}\s*(bc|bce|ad|ce)\b/.test(t) || /\b(century|siglo)\b/.test(t)) return { ok: false, reason: 'states a date or century' };
  return { ok: true };
}
module.exports = { verifyExplanation };
