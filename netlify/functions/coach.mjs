import { getStore } from '@netlify/blobs';
import { buildPrompt } from '../../src/lib/prompts.js';

/**
 * Shared-key coach endpoint.
 *
 * Security model, because this URL is public:
 *
 *  1. The client sends `{ kind, payload }` — never a prompt. Prompts are built
 *     here from a fixed set of templates, so this cannot be used as a general
 *     purpose LLM proxy by anyone who finds the endpoint.
 *  2. Every request is rate limited per IP per day, because the API key being
 *     spent is the operator's.
 *  3. If GEMINI_API_KEY is not configured, this returns 503 and the app falls
 *     back to asking the user for their own key. That means deploying this
 *     function costs nothing until a key is deliberately added.
 */

const MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const DAILY_LIMIT = Number(process.env.COACH_DAILY_LIMIT || 10);
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });

/** Hash the IP so the rate-limit store never holds an identifier. */
async function ipKey(ip) {
  const data = new TextEncoder().encode(`${ip}:${process.env.RATE_SALT || 'vv'}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return [...new Uint8Array(digest)].slice(0, 8).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default async (req, context) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return json({ error: 'no_server_key' }, 503);

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: 'bad_request' }, 400);
  }

  const built = buildPrompt(body?.kind, body?.payload);
  if (!built) return json({ error: 'bad_request' }, 400);

  // --- rate limit -----------------------------------------------------------
  const day = new Date().toISOString().slice(0, 10);
  const who = await ipKey(context?.ip || req.headers.get('x-nf-client-connection-ip') || 'unknown');
  const counterKey = `${day}/${who}`;

  let used = 0;
  let store = null;
  try {
    store = getStore('coach-usage');
    used = Number(await store.get(counterKey)) || 0;
  } catch {
    // Blobs unavailable: fail closed rather than hand out an unmetered key.
    return json({ error: 'rate_limit_unavailable' }, 503);
  }

  if (used >= DAILY_LIMIT) {
    return json({ error: 'rate_limited', limit: DAILY_LIMIT }, 429);
  }

  // --- call Gemini ----------------------------------------------------------
  let response;
  try {
    response = await fetch(`${ENDPOINT}/${MODEL}:generateContent?key=${encodeURIComponent(apiKey)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: built.prompt }] }],
        systemInstruction: { parts: [{ text: built.system }] },
        generationConfig: { maxOutputTokens: 800 }
      })
    });
  } catch {
    return json({ error: 'upstream_unreachable' }, 502);
  }

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    // Never forward the upstream message — it can name the model, the project,
    // or the key state, none of which a public caller should learn.
    console.error('Gemini error', response.status, result?.error?.message);
    return json({ error: 'upstream_error' }, 502);
  }

  const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) return json({ error: 'empty_response' }, 502);

  // Only charge the quota for calls that actually produced something.
  try {
    await store.set(counterKey, String(used + 1));
  } catch {
    // Counting failed; the answer is already paid for, so return it anyway.
  }

  return json({ text, remaining: Math.max(0, DAILY_LIMIT - (used + 1)) });
};

export const config = { path: '/api/coach' };
