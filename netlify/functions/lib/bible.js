'use strict';
// Exact-text KJV retrieval. No AI involved. Source: kjv.json (built from renniemaharaj/kjv-bible, verified).
const crypto = require('crypto');
const EXPECTED_SHA256 = 'fa32cb06809c4a72492b55db15ebdc253269194ae97f6a80b451234bdddabc2d';
const MAX_VERSES = 60;
const MAX_PASSAGES = 3;

let DATA = null, checked = false;
function load() { if (!DATA) DATA = require('./kjv.json'); return DATA; }

// Throws if the bundled Bible is not byte-for-byte what was verified.
function assertIntegrity() {
  if (checked) return;
  const d = load();
  const names = Object.keys(d);
  let c = 0, v = 0;
  for (const n of names) { c += d[n].length; for (const ch of d[n]) v += ch.length; }
  if (names.length !== 66 || c !== 1189 || v !== 31102) throw new Error('Bible data failed count check');
  const sha = crypto.createHash('sha256').update(JSON.stringify(d)).digest('hex');
  if (sha !== EXPECTED_SHA256) throw new Error('Bible data failed hash check');
  checked = true;
}

const strip = (s) => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const norm = (s) => strip(String(s).toLowerCase()).replace(/[\u2013\u2014\u2212]/g, '-').replace(/[\u2018\u2019]/g, "'")
  .replace(/\b([123])(?:st|nd|rd)\b/g, '$1').replace(/\b([123])(?=[a-z])/g, '$1 ');

// [canonical name, English aliases, Spanish aliases, number prefix (0 = none)]
const B = [
  ['Genesis', ['genesis','gen','gn'], ['genesis'], 0], ['Exodus', ['exodus','exod','exo','ex'], ['exodo'], 0],
  ['Leviticus', ['leviticus','lev','lv'], ['levitico'], 0], ['Numbers', ['numbers','num','nm'], ['numeros'], 0],
  ['Deuteronomy', ['deuteronomy','deut','dt'], ['deuteronomio'], 0], ['Joshua', ['joshua','josh','jos'], ['josue'], 0],
  ['Judges', ['judges','judg','jdg','jg'], ['jueces'], 0], ['Ruth', ['ruth'], ['rut'], 0],
  ['Samuel', ['samuel','sam'], ['samuel'], 1], ['Samuel', ['samuel','sam'], ['samuel'], 2],
  ['Kings', ['kings','kgs'], ['reyes'], 1], ['Kings', ['kings','kgs'], ['reyes'], 2],
  ['Chronicles', ['chronicles','chron','chr'], ['cronicas'], 1], ['Chronicles', ['chronicles','chron','chr'], ['cronicas'], 2],
  ['Ezra', ['ezra','ezr'], ['esdras'], 0], ['Nehemiah', ['nehemiah','neh'], ['nehemias'], 0],
  ['Esther', ['esther','est'], ['ester'], 0], ['Job', ['job'], ['job'], 0],
  ['Psalms', ['psalms','psalm','ps','psa','pss','psm'], ['salmos','salmo','sal'], 0],
  ['Proverbs', ['proverbs','prov','prv'], ['proverbios'], 0], ['Ecclesiastes', ['ecclesiastes','eccles','eccl'], ['eclesiastes'], 0],
  ['Song of Solomon', ['song of solomon','song of songs','songs of solomon','canticles','sos'], ['cantares','cantar de los cantares','cantares de salomon'], 0],
  ['Isaiah', ['isaiah','isa'], ['isaias'], 0], ['Jeremiah', ['jeremiah','jer'], ['jeremias'], 0],
  ['Lamentations', ['lamentations','lam'], ['lamentaciones'], 0], ['Ezekiel', ['ezekiel','ezek','eze'], ['ezequiel'], 0],
  ['Daniel', ['daniel','dan'], ['daniel'], 0], ['Hosea', ['hosea','hos'], ['oseas'], 0], ['Joel', ['joel'], ['joel'], 0],
  ['Amos', ['amos'], ['amos'], 0], ['Obadiah', ['obadiah','obad'], ['abdias'], 0], ['Jonah', ['jonah','jon'], ['jonas'], 0],
  ['Micah', ['micah','mic'], ['miqueas'], 0], ['Nahum', ['nahum','nah'], ['nahum'], 0], ['Habakkuk', ['habakkuk','hab'], ['habacuc'], 0],
  ['Zephaniah', ['zephaniah','zeph'], ['sofonias'], 0], ['Haggai', ['haggai','hag'], ['hageo'], 0],
  ['Zechariah', ['zechariah','zech'], ['zacarias'], 0], ['Malachi', ['malachi','mal'], ['malaquias'], 0],
  ['Matthew', ['matthew','matt','mt'], ['mateo'], 0], ['Mark', ['mark','mrk','mk'], ['marcos'], 0],
  ['Luke', ['luke','luk','lk'], ['lucas'], 0], ['John', ['john','jhn','jn'], ['juan'], 0],
  ['Acts', ['acts'], ['hechos'], 0], ['Romans', ['romans','rom'], ['romanos'], 0],
  ['Corinthians', ['corinthians','cor'], ['corintios'], 1], ['Corinthians', ['corinthians','cor'], ['corintios'], 2],
  ['Galatians', ['galatians','gal'], ['galatas'], 0], ['Ephesians', ['ephesians','eph'], ['efesios'], 0],
  ['Philippians', ['philippians','phil','php'], ['filipenses'], 0], ['Colossians', ['colossians','col'], ['colosenses'], 0],
  ['Thessalonians', ['thessalonians','thess','thes'], ['tesalonicenses'], 1], ['Thessalonians', ['thessalonians','thess','thes'], ['tesalonicenses'], 2],
  ['Timothy', ['timothy','tim'], ['timoteo'], 1], ['Timothy', ['timothy','tim'], ['timoteo'], 2],
  ['Titus', ['titus','tit'], ['tito'], 0], ['Philemon', ['philemon','philem','phm'], ['filemon'], 0],
  ['Hebrews', ['hebrews','heb'], ['hebreos'], 0], ['James', ['james','jas'], ['santiago'], 0],
  ['Peter', ['peter','pet'], ['pedro'], 1], ['Peter', ['peter','pet'], ['pedro'], 2],
  ['John', ['john','jhn','jn'], ['juan'], 1], ['John', ['john','jhn','jn'], ['juan'], 2], ['John', ['john','jhn','jn'], ['juan'], 3],
  ['Jude', ['jude'], ['judas'], 0], ['Revelation', ['revelation','revelations','rev'], ['apocalipsis'], 0],
];
const PREFIX = { 1: ['1','i','first','primera de','primero de','primera','primero'], 2: ['2','ii','second','segunda de','segundo de','segunda','segundo'], 3: ['3','iii','third','tercera de','tercero de','tercera','tercero'] };

const CANON = [];            // canonical names in Bible order, e.g. "1 John"
const ALIAS = new Map();     // normalized alias -> canonical name
for (const [base, en, es, n] of B) {
  const canon = n ? n + ' ' + base : base;
  if (!CANON.includes(canon)) CANON.push(canon);
  for (const a of en.concat(es)) {
    if (!n) ALIAS.set(a, canon);
    else for (const p of PREFIX[n]) ALIAS.set(p + ' ' + a, canon);
  }
  ALIAS.set(norm(canon), canon);
}
if (CANON.length !== 66) throw new Error('book table must have 66 books');

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const ALIAS_RE = [...ALIAS.keys()].sort((a, b) => b.length - a.length).map((a) => esc(a).replace(/ /g, '\\s+')).join('|');
const RSEP = '(?:\\s*-\\s*|\\s+(?:to|through|thru|a|al)\\s+)';
const ITEM = '\\d{1,3}(?:' + RSEP + '\\d{1,3})?';
const VLIST = ITEM + '(?:\\s*,\\s*' + ITEM + '(?=\\s*(?:$|[,;.?!)]|and\\b|y\\b|&)))*';
const REF_RE = new RegExp('(?<![a-z0-9])(' + ALIAS_RE + ')\\.?(?:\\s+(?:chapter|chap|ch|capitulo|cap)\\.?)?\\s*(\\d{1,3})' +
  '(?:\\s*:\\s*(' + VLIST + ')|\\s*,?\\s*(?:verses?|vv|vs|versos?|versiculos?)\\.?\\s*(' + VLIST + '))?', 'g');
const LOOSE_RE = /(?<![a-z0-9])((?:[123]\s+)?[a-z]{2,})\.?\s*(\d{1,3})\s*:\s*(\d{1,3})/g;
const STOP = new Set(['at','by','from','on','in','to','until','about','around','is','was','time','pm','am','of','and','the','for','it','as','than','after','before','between','ratio','score','chapter','verse']);

function parseRanges(spec) {
  return spec.split(',').map((p) => p.trim().split(RSEPSPLIT).map(Number)).map(([a, b]) => [a, b === undefined ? a : b]);
}
const RSEPSPLIT = /\s*-\s*|\s+(?:to|through|thru|a|al)\s+/;

const display = (canon) => canon === 'Psalms' ? 'Psalm' : canon;
function labelOf(canon, chapter, ranges) {
  const r = ranges ? ':' + ranges.map(([a, b]) => (a === b ? a : a + '-' + b)).join(', ') : '';
  return display(canon) + ' ' + chapter + r;
}

// Finds Bible references in free text. Does not touch the Bible data.
function parseReferences(text) {
  const t = norm(text);
  const found = [], spans = [], seen = new Set();
  REF_RE.lastIndex = 0;
  let m;
  while ((m = REF_RE.exec(t)) !== null) {
    spans.push([m.index, m.index + m[0].length]);
    const book = ALIAS.get(m[1].replace(/\s+/g, ' '));
    const chapter = Number(m[2]);
    const spec = m[3] || m[4];
    const ranges = spec ? parseRanges(spec) : null;
    const key = book + '|' + chapter + '|' + JSON.stringify(ranges);
    if (seen.has(key)) continue;
    seen.add(key);
    found.push({ book, chapter, ranges, label: labelOf(book, chapter, ranges) });
  }
  const unrecognized = [];
  LOOSE_RE.lastIndex = 0;
  while ((m = LOOSE_RE.exec(t)) !== null) {
    const inside = spans.some(([s, e]) => m.index >= s && m.index < e);
    const first = m[1].trim().split(/\s+/).pop();
    if (!inside && !STOP.has(first)) unrecognized.push(m[0].trim());
  }
  return { found, unrecognized };
}

// Looks up exact text. Returns { passages, errors }. Throws only if the Bible source itself is broken.
function resolve(found) {
  assertIntegrity();
  const data = load();
  const passages = [], errors = [];
  let total = 0;
  for (const f of found.slice(0, MAX_PASSAGES)) {
    const chapters = data[f.book];
    if (!chapters) throw new Error('Bible source missing ' + f.book);
    const name = display(f.book);
    if (f.chapter < 1 || f.chapter > chapters.length) { errors.push({ code: 'chapter', book: name, chapter: f.chapter, max: chapters.length }); continue; }
    const verses = chapters[f.chapter - 1];
    let nums = [], bad = false;
    if (!f.ranges) nums = verses.map((_, i) => i + 1);
    else for (const [a, b] of f.ranges) {
      if (a < 1 || b < a) { errors.push({ code: 'range', label: f.label }); bad = true; break; }
      if (b > verses.length) { errors.push({ code: 'verse', book: name, chapter: f.chapter, verse: b, max: verses.length }); bad = true; break; }
      for (let v = a; v <= b; v++) nums.push(v);
    }
    if (bad) continue;
    nums = [...new Set(nums)].sort((x, y) => x - y);
    total += nums.length;
    passages.push({ label: f.label, book: f.book, chapter: f.chapter, verses: nums.map((n) => ({ n, text: verses[n - 1] })) });
  }
  if (!errors.length && total > MAX_VERSES) { errors.push({ code: 'too_long', max: MAX_VERSES }); return { passages: [], errors }; }
  return { passages, errors };
}

function formatPassage(p) { return p.label + ' (KJV)\n' + p.verses.map((v) => v.n + ' ' + v.text).join('\n'); }

module.exports = { parseReferences, resolve, formatPassage, assertIntegrity, norm, MAX_VERSES, MAX_PASSAGES, CANON };
