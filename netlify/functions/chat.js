// Netlify Function: private Groq proxy for the Psalm Sound Worship Bible assistant.
// Keep GROQ_API_KEY_1 only in Netlify's server-side environment variables.

const SYSTEM_PROMPT = [
  'You are a warm, reverent Bible guide specializing in the KJV Psalms and the entire Bible.',
  'Answer questions about Scripture, meaning, context, and Christian faith. If a question is unrelated to the Bible or faith, politely explain your focus.',
  'Respond in the same language the user writes in: English or Spanish.',
  'When quoting English Scripture, use the King James Version (KJV). When quoting Spanish Scripture, use Reina-Valera 1960 (RVR1960).',
  'Do not invent exact Bible quotations or verse references. If unsure of exact wording, clearly say you are paraphrasing.',
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
