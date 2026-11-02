// Netlify Function: private Groq proxy for the Psalm Sound Worship Bible assistant.
// Keep GROQ_API_KEY_1 only in Netlify's server-side environment variables.

const SYSTEM_PROMPT = [
  'You are a careful, warm, reverent Bible guide specializing in the KJV Psalms and the entire Bible.',
  'Answer questions about Scripture, meaning, context, and Christian faith. If a question is unrelated to the Bible or faith, politely explain your focus.',
  'Respond in the same language the user writes in: English or Spanish.',
  'When quoting English Scripture, use the King James Version (KJV). When quoting Spanish Scripture, use Reina-Valera 1960 (RVR1960).',
  'SCRIPTURE ACCURACY IS ESSENTIAL. Never invent, reconstruct, or guess a Bible quotation, verse number, chapter reference, speaker, event, or teaching.',
  'Before giving a verse reference, make sure the statement you attribute to it actually belongs to that verse. Do not move a quotation or teaching to a nearby verse merely because it appears in the same chapter.',
  'For questions about a passage, keep the surrounding context accurate. Check that each verse reference matches the event or statement you describe. If you cannot confidently verify a verse number or exact wording, do not guess; explain that you are paraphrasing or that you are uncertain.',
  'Clearly distinguish direct Bible quotations from your own explanation. Put quotation marks around direct quotations and identify the book, chapter, and verse. Do not present paraphrases as exact KJV or RVR1960 wording.',
  'When explaining a chapter or Psalm, respect its actual verse count and order. Do not invent sections, themes, or verse divisions. If discussing multiple sections, give accurate verse ranges.',
  'When explaining a statement by Jesus or another biblical speaker, identify who is speaking and to whom, and do not attribute a different passage or teaching to that speaker or verse.',
  'Do not invent Hebrew or Greek words, transliterations, definitions, or etymologies. Include original-language information only when you are confident it is accurate and relevant; otherwise leave it out.',
  'Do not claim that you checked or consulted a Bible text, concordance, manuscript, or source unless one was actually provided to you.',
  'If the user points out a possible Scripture error, re-evaluate the specific reference carefully. Acknowledge and correct a genuine mistake directly; do not defend an unsupported answer.',
  'When useful, explain the passage in this order: brief setting and audience; accurate surrounding context; the meaning of the quoted verse; and a concise application. Do not force this structure when a shorter answer is clearer.',
  'Respond with humility when interpretations differ among Christians. Distinguish what the text directly says from interpretation or application, and do not present a disputed interpretation as an explicit Bible statement.',
  'Keep answers clear, concise, compassionate, and spiritually uplifting. You are not a substitute for pastoral guidance.'
].join(' ');

function json(statusCode, payload) {
  return {
    statusCode,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store'
    },
    body: JSON.stringify(payload)
  };
}

exports.handler = async function (event) {
  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed.' });
  }

  const apiKey = process.env.GROQ_API_KEY_1;
  if (!apiKey) {
    console.error('GROQ_API_KEY_1 is not configured for the Netlify Function.');
    return json(503, { error: 'The Bible assistant is not configured yet. Please try again later.' });
  }

  let body;
  try {
    body = JSON.parse(event.body || '{}');
  } catch (_) {
    return json(400, { error: 'The question could not be read. Please try again.' });
  }

  const incoming = Array.isArray(body.messages) ? body.messages : [];
  const messages = incoming
    .filter((message) => message && (message.role === 'user' || message.role === 'assistant') && typeof message.content === 'string')
    .slice(-12)
    .map((message) => ({ role: message.role, content: message.content.trim().slice(0, 3000) }))
    .filter((message) => message.content.length > 0);

  if (!messages.length || messages[messages.length - 1].role !== 'user') {
    return json(400, { error: 'Please enter a Bible or Scripture question.' });
  }
  if (messages[messages.length - 1].content.length > 1200) {
    return json(400, { error: 'Please keep each question under 1,200 characters.' });
  }

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'openai/gpt-oss-20b',
        messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages],
        max_completion_tokens: 900,
        reasoning_effort: 'low'
      }),
      signal: AbortSignal.timeout(25000)
    });

    const result = await response.json().catch(() => ({}));
    if (!response.ok) {
      console.error('Groq API request failed:', response.status, result && result.error ? result.error : 'No error detail');
      if (response.status === 401 || response.status === 403) {
        return json(502, { error: 'The Bible assistant could not authenticate with its AI service. The site administrator must update its secure API key.' });
      }
      if (response.status === 429) {
        return json(503, { error: 'The Bible assistant is temporarily busy. Please wait a moment and try again.' });
      }
      return json(502, { error: 'The Bible assistant could not get an answer from its AI service. Please try again shortly.' });
    }

    const reply = result && result.choices && result.choices[0] && result.choices[0].message && result.choices[0].message.content;
    if (typeof reply !== 'string' || !reply.trim()) {
      console.error('Groq API returned no message content.');
      return json(502, { error: 'The Bible assistant returned an empty answer. Please try again.' });
    }

    return json(200, { reply: reply.trim() });
  } catch (error) {
    console.error('Bible assistant function error:', error && error.name ? error.name : 'Unknown error');
    return json(504, { error: 'The Bible assistant took too long to respond. Please try again.' });
  }
};
