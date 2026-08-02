/**
 * Every prompt the coach can send, built from structured input.
 *
 * This module is imported by BOTH the browser (when a user supplies their own
 * API key) and the Netlify function (when using the shared server key). That is
 * deliberate: the server must never accept a prompt string from the client. If
 * it did, the shared key would be a free general-purpose LLM proxy for anyone
 * who found the URL.
 *
 * Pure and side-effect free so it can be tested without a network.
 */

export const KINDS = ['reframe', 'social', 'gap'];

// Caps on anything that reaches a prompt. Stops a pasted novel from turning
// into an expensive call, and bounds what an abusive client can smuggle in.
const LIMITS = {
  field: 280,
  market: 80,
  rows: 7,
  row: 400
};

const clean = (value, max) =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';

/** Where the agent works, defaulting to something market-neutral. */
function marketPhrase(market) {
  const where = clean(market, LIMITS.market);
  return where ? `a real estate agent in ${where}` : 'a real estate agent';
}

const COACH_VOICE =
  "You are an elite, empathetic, and witty real estate business coach. Keep it concise, " +
  "encouraging, and forward-thinking. Think 'coach who believes in you but won't let you slack'.";

function reframe(payload) {
  const feeling = clean(payload.feeling, LIMITS.field);
  const win = clean(payload.win, LIMITS.field);
  if (!feeling) return null;

  return {
    system: COACH_VOICE,
    prompt:
      `I am ${marketPhrase(payload.market)}. Today I am feeling: ${feeling}. ` +
      `My win today was: ${win || '(nothing noted yet)'}. ` +
      `Give me a quick 1-2 sentence coaching reframe or celebration. If I am feeling down or ` +
      `blocked, give me a gentle, empathetic nudge toward a specific high-ROI activity.`
  };
}

function social(payload) {
  const win = clean(payload.win, LIMITS.field);
  if (!win) return null;

  const where = clean(payload.market, LIMITS.market);
  return {
    system:
      "You are a savvy real estate marketing expert. Use emojis sparingly. Focus on " +
      "'local expert' vibes.",
    prompt:
      `Draft a professional yet high-energy social media post for LinkedIn and Facebook based ` +
      `on this win: ${win}. Focus on value for my community${where ? ` in ${where}` : ''}. ` +
      `Keep it under 200 words.`
  };
}

function gap(payload) {
  const rows = Array.isArray(payload.rows)
    ? payload.rows.slice(0, LIMITS.rows).map((row) => clean(row, LIMITS.row)).filter(Boolean)
    : [];

  return {
    system:
      `You are an elite real estate coach for a top-producing agent${
        clean(payload.market, LIMITS.market) ? ` in ${clean(payload.market, LIMITS.market)}` : ''
      }. Be concise, empathetic, and use clever humor. Focus on identifying sales funnel gaps.`,
    prompt:
      `Act as my elite real estate business coach. Here is my activity and production data for ` +
      `the last 7 days:\n${rows.join('\n') || '(no entries recorded yet)'}\n\n` +
      `Analyze this data. Identify 1-2 critical gaps in my activities or production. ` +
      `Then, give me an encouraging, forward-thinking challenge.`
  };
}

const BUILDERS = { reframe, social, gap };

/**
 * Build a prompt for `kind` from `payload`.
 * Returns null for an unknown kind or input too empty to be worth a call —
 * callers treat null as "don't spend a request".
 */
export function buildPrompt(kind, payload) {
  const builder = BUILDERS[kind];
  if (!builder) return null;
  if (payload === null || typeof payload !== 'object' || Array.isArray(payload)) return null;
  return builder(payload);
}

/** Turn the stored week into the compact rows the gap analysis reasons over. */
export function rowsFromEntries(entriesByDate, dateKeys) {
  return dateKeys
    .map((date) => {
      const e = entriesByDate[date];
      if (!e) return null;
      const conversations = (e.activities?.calls || 0) + (e.activities?.texts || 0);
      return (
        `Date: ${date}, Feeling: ${e.mindset?.feeling || '-'}, Win: ${e.mindset?.win || '-'}, ` +
        `Peak Time: ${e.mindset?.peakTime || '-'}, Roadblock: ${e.mindset?.roadblock || '-'}, ` +
        `Calls/Texts: ${conversations}, Check-ins: ${e.activities?.clientCheckIns || 0}, ` +
        `Evals: ${e.production?.evaluations || 0}, Pendings: ${e.production?.pendings || 0}.`
      );
    })
    .filter(Boolean);
}
