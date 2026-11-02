'use strict';
// The ONLY file that knows which AI service is used. To switch providers, replace complete().
// Secrets come from server-side environment variables only (Netlify: Site settings > Environment variables).
class ProviderError extends Error { constructor(code) { super(code); this.code = code; } }

async function complete({ system, user, timeoutMs }) {
  const key = process.env.GROQ_API_KEY_1 || process.env.GROQ_API_KEY;  const model = process.env.GROQ_MODEL || 'llama-3.3-70b-versatile';
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs || 8000);
  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, temperature: 0.2, max_tokens: 450, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
      signal: ctrl.signal,
    });
    if (r.status === 429) throw new ProviderError('rate_limit');
    if (r.status === 401 || r.status === 403) throw new ProviderError('auth');
    if (!r.ok) throw new ProviderError('unavailable');
    const j = await r.json();
    const text = j && j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content;
    if (!text) throw new ProviderError('empty');
    return String(text).trim();
  } catch (e) {
    if (e instanceof ProviderError) throw e;
    throw new ProviderError(e && e.name === 'AbortError' ? 'timeout' : 'unavailable');
  } finally { clearTimeout(timer); }
}
module.exports = { complete, ProviderError };
