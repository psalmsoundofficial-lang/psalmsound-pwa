'use strict';
// Scripture assistant. Order of operations: find reference -> retrieve exact KJV text -> AI explains -> verify -> reply.
// The Bible text shown to visitors always comes from the local KJV database, never from the AI.
const SYSTEM = [
  'You explain Bible passages for a Christian worship website.',
  'The passage text is provided between <<< and >>>. It is the ONLY source you may rely on.',
  'Rules you must follow without exception:',
  '- Use double quotation marks ONLY around words copied exactly, letter for letter, from the provided passage. Never use double quotation marks for anything else, and never quote any other Bible text.',
  '- Mention only verses that are in the provided passage, by number (for example "verse 3"). Do not cite or mention any other verse, chapter or book.',
  '- Do not give Hebrew or Greek words, word meanings, word origins, dates, authorship or historical facts. If asked for these, say plainly that they are outside the provided text and cannot be verified here.',
  '- Phrase every interpretation as interpretation (for example "One way to read this is...").',
  '- Answer in the same language as the question (English or Spanish), but any quoted Scripture stays in the English KJV exactly as provided.',
  '- Be warm and clear, 100 to 180 words, plain text only: no markdown, no headings, no bullet lists.',
].join('\n');

const STR = {
  en: {
    noRef: 'I explain specific Bible passages using the exact King James text. Please include a reference, for example "Psalm 23", "John 14:1-6" or "Romans 8:28". I don\'t answer from memory, because I could get Scripture wrong.',
    none: 'No Scripture was retrieved, so I\'m not showing any quotation.',
    chapter: (e) => e.book + ' has only ' + e.max + ' chapters; chapter ' + e.chapter + ' does not exist.',
    verse: (e) => e.book + ' ' + e.chapter + ' has only ' + e.max + ' verses; verse ' + e.verse + ' does not exist.',
    range: (e) => '"' + e.label + '" is not a valid verse range.',
    unknown: (t) => 'I don\'t recognize "' + t + '" as a Bible reference.',
    too_long: (e) => 'That is more than ' + e.max + ' verses, which is too much for one answer. Please ask about a smaller section, for example Psalm 119:1-16.',
    bibleDown: 'The Bible text source is unavailable right now, so I can\'t provide verified Scripture. I won\'t quote from memory. Please try again later.',
    aiLimit: 'The explanation service is unavailable or has reached its free usage limit right now. Here is the exact Scripture text without an explanation:',
    aiRejected: 'I couldn\'t produce an explanation I could check against the text, so here is the exact Scripture only:',
    explain: 'Explanation (interpretation, not Scripture; AI-generated and may contain mistakes):',
    esNote: '',
  },
  es: {
    noRef: 'Explico pasajes bíblicos concretos usando el texto exacto de la versión King James. Por favor incluye una referencia, por ejemplo "Salmo 23", "Juan 14:1-6" o "Romanos 8:28". No respondo de memoria, porque podría equivocarme con la Escritura.',
    none: 'No se obtuvo ningún pasaje, así que no muestro ninguna cita.',
    chapter: (e) => e.book + ' solo tiene ' + e.max + ' capítulos; el capítulo ' + e.chapter + ' no existe.',
    verse: (e) => e.book + ' ' + e.chapter + ' solo tiene ' + e.max + ' versículos; el versículo ' + e.verse + ' no existe.',
    range: (e) => '"' + e.label + '" no es un rango de versículos válido.',
    unknown: (t) => 'No reconozco "' + t + '" como una referencia bíblica.',
    too_long: (e) => 'Son más de ' + e.max + ' versículos, demasiado para una sola respuesta. Pide una sección más pequeña, por ejemplo Salmo 119:1-16.',
    bibleDown: 'La fuente del texto bíblico no está disponible ahora, así que no puedo ofrecer Escritura verificada. No citaré de memoria. Inténtalo más tarde.',
    aiLimit: 'El servicio de explicaciones no está disponible o alcanzó su límite gratuito. Este es el texto exacto de la Escritura, sin explicación:',
    aiRejected: 'No pude producir una explicación que pudiera comprobar contra el texto, así que muestro solo la Escritura exacta:',
    explain: 'Explicación (interpretación, no Escritura; generada por IA y puede contener errores):',
    esNote: 'Nota: el texto bíblico mostrado es la versión King James (KJV) en inglés. Aún no hay instalada una versión en español verificada, por lo que no se cita ninguna.',
  },
};

const isSpanish = (t) => /[¿¡ñáéíóú]/i.test(t) || /\b(que|qué|significa|salmos?|explica\w*|dime|cual|cuál|versiculos?|versículos?|capitulo|capítulo|dios|jesus|jesús|biblia)\b/i.test(t);
const tidy = (s) => s.replace(/\*\*|__/g, '').replace(/^#+\s*/gm, '').trim();

function createHandler(deps) {
  deps = deps || {};
  const bible = deps.bible || require('./lib/bible');
  const provider = deps.provider || require('./lib/provider');
  const verify = deps.verify || require('./lib/verify');

  const send = (code, obj) => ({ statusCode: code, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }, body: JSON.stringify(obj) });
  const reply = (text) => send(200, { reply: text });

  return async function handler(event) {
    const started = Date.now();
    if (event.httpMethod !== 'POST') return send(405, { error: 'Method not allowed' });
    let body;
    try { body = JSON.parse(event.body || '{}'); } catch (e) { return send(400, { error: 'Bad request' }); }
    const msgs = Array.isArray(body.messages) ? body.messages : [];
    const last = msgs.slice().reverse().find((m) => m && m.role === 'user' && typeof m.content === 'string');
    if (!last) return send(400, { error: 'No question provided' });
    const question = last.content.trim().slice(0, 500);
    const S = STR[isSpanish(question) ? 'es' : 'en'];
    const withNote = (t) => (S.esNote ? t + '\n\n' + S.esNote : t);

    // 1-2. Identify the requested passage(s).
    const parsed = bible.parseReferences(question);
    if (!parsed.found.length && !parsed.unrecognized.length) return reply(S.noRef);

    // 3. Retrieve exact text from the verified local KJV. If this fails, nothing is quoted and the AI is never called.
    let res;
    try { res = bible.resolve(parsed.found); } catch (e) { console.error('bible source error:', e.message); return reply(S.bibleDown); }
    const problems = parsed.unrecognized.map((t) => S.unknown(t)).concat(res.errors.map((e) => S[e.code](e)));
    if (problems.length) return reply(problems.join('\n') + '\n\n' + S.none);

    const scripture = res.passages.map((p) => '📖 ' + bible.formatPassage(p).replace(' (KJV)', ' (King James Version)')).join('\n\n');

    // 4-5. Give the retrieved text to the AI, which may only explain it.
    const promptText = res.passages.map(bible.formatPassage).join('\n\n');
    let user = 'Question: ' + question + '\n\n<<<\n' + promptText + '\n>>>';
    let failure = 'limit';
    for (let attempt = 0; attempt < 2; attempt++) {
      const remaining = 9000 - (Date.now() - started);
      if (remaining < 2500) break;
      let answer;
      try { answer = tidy(await provider.complete({ system: SYSTEM, user, timeoutMs: remaining - 500 })); }
      catch (e) { console.error('AI provider error:', e && e.code); failure = 'limit'; break; }
      // 6-7. Verify quotations and references against the retrieved text before showing anything.
      const v = verify.verifyExplanation(answer, res.passages);
      if (v.ok) return reply(withNote(scripture + '\n\n' + S.explain + '\n' + answer));
      console.error('explanation rejected:', v.reason);
      failure = 'rejected';
      user += '\n\nYour previous answer was rejected (' + v.reason + '). Rewrite it: use double quotation marks only for words copied exactly from the passage, cite no other verses, and include no Hebrew, Greek, dates or history.';
    }
    return reply(withNote((failure === 'rejected' ? S.aiRejected : S.aiLimit) + '\n\n' + scripture));
  };
}

exports.handler = createHandler();
exports.createHandler = createHandler;
exports.STR = STR;
