/**
 * Gemini calls.
 *
 * The key currently lives in the browser because this is a single-user app on
 * a personal phone. The moment this URL is shared with anyone else, these calls
 * need to move behind a Netlify Function with the key as an env var — the
 * request shapes below are deliberately the only place that would need to change.
 */

// Gemini 1.5 Flash was retired in Sept 2025; a fresh key returns 404 for it.
export const GEMINI_MODEL = 'gemini-2.5-flash';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

async function callGemini(apiKey, prompt, systemPrompt) {
  const url = `${ENDPOINT}/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(apiKey.trim())}`;

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: systemPrompt }] }
      })
    });
  } catch (e) {
    return `Connection error: ${e?.message || 'check your internet connection.'}`;
  }

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    const detail = result?.error?.message || `HTTP ${response.status}`;
    return `API error (${GEMINI_MODEL}): ${detail}`;
  }

  return result?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated.';
}

const COACH_VOICE =
  "You are an elite, empathetic, and witty real estate business coach. Keep it concise, " +
  "encouraging, and forward-thinking. Think 'coach who believes in you but won't let you slack'.";

export function reframeDay(apiKey, entry) {
  const prompt =
    `I am a real estate agent in Tampa/East Pasco. Today I am feeling: ${entry.mindset.feeling}. ` +
    `My win today was: ${entry.mindset.win}. ` +
    `Give me a quick 1-2 sentence coaching reframe or celebration. If I am feeling down or blocked, ` +
    `give me a gentle, empathetic nudge toward a specific high-ROI activity.`;
  return callGemini(apiKey, prompt, COACH_VOICE);
}

export function draftSocialPost(apiKey, entry) {
  const prompt =
    `Draft a professional yet high-energy social media post for LinkedIn and Facebook based on ` +
    `this win: ${entry.mindset.win}. Focus on value for my community in Florida real estate. ` +
    `Keep it under 200 words.`;
  const voice =
    "You are a savvy real estate marketing expert. Use emojis sparingly. Focus on 'local expert' vibes.";
  return callGemini(apiKey, prompt, voice);
}

export function gapAnalysis(apiKey, entriesByDate, dateKeys) {
  const rows = dateKeys
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
    .filter(Boolean)
    .join('\n');

  const prompt =
    `Act as my elite real estate business coach. Here is my activity and production data for the ` +
    `last 7 days:\n${rows || '(no entries recorded yet)'}\n\n` +
    `Analyze this data. Identify 1-2 critical gaps in my activities or production. ` +
    `Then, give me an encouraging, forward-thinking challenge.`;
  const voice =
    'You are an elite real estate coach for a top RE/MAX agent in East Pasco/Tampa. Be concise, ' +
    'empathetic, and use clever humor. Focus on identifying sales funnel gaps.';
  return callGemini(apiKey, prompt, voice);
}
