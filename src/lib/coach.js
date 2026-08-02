/**
 * Coach calls, with two paths:
 *
 *   1. The shared server key, via /api/coach. Rate limited per IP per day.
 *   2. The user's own Gemini key, straight from the browser.
 *
 * The server is tried first. If it has no key configured (503) or the caller is
 * out of daily requests (429), we fall back to path 2 when the user has supplied
 * a key of their own — and otherwise say plainly which of the two happened.
 */
import { buildPrompt, rowsFromEntries } from './prompts.js';

export const GEMINI_MODEL = 'gemini-2.5-flash';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

/** Result shape: { ok, text, reason } — never throws. */
async function viaServer(kind, payload) {
  let response;
  try {
    response = await fetch('/api/coach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, payload })
    });
  } catch {
    return { ok: false, reason: 'offline' };
  }

  if (response.ok) {
    const data = await response.json().catch(() => ({}));
    return data.text
      ? { ok: true, text: data.text, remaining: data.remaining }
      : { ok: false, reason: 'upstream' };
  }

  if (response.status === 503) return { ok: false, reason: 'no_server_key' };
  if (response.status === 429) return { ok: false, reason: 'rate_limited' };
  if (response.status === 404) return { ok: false, reason: 'no_server_key' };
  return { ok: false, reason: 'upstream' };
}

async function viaUserKey(apiKey, kind, payload) {
  const built = buildPrompt(kind, payload);
  if (!built) return { ok: false, reason: 'incomplete' };

  let response;
  try {
    response = await fetch(
      `${ENDPOINT}/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey.trim())}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: built.prompt }] }],
          systemInstruction: { parts: [{ text: built.system }] }
        })
      }
    );
  } catch {
    return { ok: false, reason: 'offline' };
  }

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    return { ok: false, reason: 'key_error', detail: result?.error?.message || `HTTP ${response.status}` };
  }

  const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
  return text ? { ok: true, text } : { ok: false, reason: 'upstream' };
}

const MESSAGES = {
  offline: 'Could not reach the coach — check your connection and try again.',
  upstream: 'The coach had trouble responding. Try again in a moment.',
  incomplete: 'Fill in a little more first, then ask again.',
  rate_limited:
    "You've used today's free coaching. It resets tomorrow — or add your own Gemini API key in " +
    'settings for unlimited use.',
  no_server_key: 'Add your own Gemini API key in settings to turn on coaching.'
};

/**
 * Ask the coach. Returns { ok, text } or { ok: false, message }.
 */
export async function askCoach(kind, payload, userKey) {
  if (!buildPrompt(kind, payload)) {
    return { ok: false, message: MESSAGES.incomplete };
  }

  const server = await viaServer(kind, payload);
  if (server.ok) return server;

  const canFallBack = Boolean(userKey) && ['no_server_key', 'rate_limited'].includes(server.reason);
  if (!canFallBack) {
    return { ok: false, message: MESSAGES[server.reason] || MESSAGES.upstream };
  }

  const direct = await viaUserKey(userKey, kind, payload);
  if (direct.ok) return direct;

  if (direct.reason === 'key_error') {
    return { ok: false, message: `Your API key was rejected: ${direct.detail}` };
  }
  return { ok: false, message: MESSAGES[direct.reason] || MESSAGES.upstream };
}

export const coachPayloads = {
  reframe: (entry, market) => ({ feeling: entry.mindset.feeling, win: entry.mindset.win, market }),
  social: (entry, market) => ({ win: entry.mindset.win, market }),
  gap: (entriesByDate, dateKeys, market) => ({ rows: rowsFromEntries(entriesByDate, dateKeys), market })
};
