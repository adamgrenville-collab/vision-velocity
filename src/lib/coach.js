/**
 * Coach calls.
 *
 * Bring-your-own-key only, by design. Every request is billed to the key the
 * person using the app supplied, from their own browser, to Google. The app
 * operator is never in the payment path and there is no shared key to abuse.
 *
 * Google AI Studio has a free tier, so for most users this costs nothing.
 *
 * Prompts are built by ./prompts.js, which caps input length and keeps the
 * templates market-neutral. If a shared server key is ever reintroduced, the
 * server must build the prompt — see git history for a worked version.
 */
import { buildPrompt, rowsFromEntries } from './prompts.js';
import { failureMessage } from './coachErrors.js';

export const GEMINI_MODEL = 'gemini-2.5-flash';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

const MESSAGES = {
  no_key: 'Add a Gemini API key in settings to turn on coaching. It stays on this device.',
  incomplete: 'Fill in a little more first, then ask again.',
  offline: 'Could not reach the coach — check your connection and try again.',
  upstream: 'The coach had trouble responding. Try again in a moment.'
};

/**
 * Ask the coach. Returns { ok: true, text } or { ok: false, message }.
 * Never throws.
 */
export async function askCoach(kind, payload, apiKey) {
  const built = buildPrompt(kind, payload);
  if (!built) return { ok: false, message: MESSAGES.incomplete };
  if (!apiKey) return { ok: false, message: MESSAGES.no_key };

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
    return { ok: false, message: MESSAGES.offline };
  }

  const result = await response.json().catch(() => ({}));

  // Not every failure is a bad key — see ./coachErrors.js.
  if (!response.ok) {
    return { ok: false, message: failureMessage(response.status, result?.error) };
  }

  const text = result?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (text) return { ok: true, text };

  // A 200 with no text usually means the response was cut off or filtered.
  const reason = result?.candidates?.[0]?.finishReason;
  if (reason && reason !== 'STOP') {
    return {
      ok: false,
      message: `The coach stopped early (${reason}). Try rephrasing what you logged, or ask again.`
    };
  }
  return { ok: false, message: MESSAGES.upstream };
}

/**
 * A minimal call, purely to find out whether a key works and say why not.
 * Used by the "Test key" button so a failure names its own cause instead of
 * being inferred from a coaching button that did nothing.
 */
export async function testKey(apiKey) {
  const key = String(apiKey || '').trim();
  if (!key) return { ok: false, message: MESSAGES.no_key };

  let response;
  try {
    response = await fetch(`${ENDPOINT}/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Reply with the single word: ready' }] }],
        generationConfig: { maxOutputTokens: 10 }
      })
    });
  } catch {
    return { ok: false, message: MESSAGES.offline };
  }

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { ok: false, message: failureMessage(response.status, result?.error) };
  }
  return { ok: true, message: `Working — ${GEMINI_MODEL} answered.` };
}

export const coachPayloads = {
  reframe: (entry, market) => ({ feeling: entry.mindset.feeling, win: entry.mindset.win, market }),
  social: (entry, market) => ({ win: entry.mindset.win, market }),
  gap: (entriesByDate, dateKeys, market) => ({
    rows: rowsFromEntries(entriesByDate, dateKeys),
    market
  })
};
