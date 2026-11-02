'use strict';
// Exact KJV lookup with NO AI. Example: /.netlify/functions/passage?ref=John%2014:1-6
const bible = require('./lib/bible');
exports.handler = async (event) => {
  const h = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' };
  const ref = String((event.queryStringParameters && event.queryStringParameters.ref) || '').slice(0, 200);
  const parsed = bible.parseReferences(ref);
  if (!parsed.found.length) return { statusCode: 400, headers: h, body: JSON.stringify({ ok: false, errors: [{ code: 'no_reference' }].concat(parsed.unrecognized.map((t) => ({ code: 'unknown', text: t }))) }) };
  let res;
  try { res = bible.resolve(parsed.found); } catch (e) { return { statusCode: 503, headers: h, body: JSON.stringify({ ok: false, errors: [{ code: 'bible_unavailable' }] }) }; }
  if (res.errors.length) return { statusCode: 404, headers: h, body: JSON.stringify({ ok: false, errors: res.errors }) };
  return { statusCode: 200, headers: h, body: JSON.stringify({ ok: true, translation: 'KJV', passages: res.passages }) };
};
