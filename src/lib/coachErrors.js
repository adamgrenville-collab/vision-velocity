/**
 * Turning Google's API failures into something a working agent can act on.
 *
 * The previous version reported every non-OK response as "your API key was
 * rejected", which is wrong for most of them and sends people off to regenerate
 * a key that was never the problem. A quota exhaustion, a disabled API and a
 * restricted key all need different fixes.
 *
 * Pure and exported so the mapping is tested rather than assumed.
 */

/**
 * Pull Google's machine-readable reason out of the error envelope.
 * `details` is whatever the network handed us, so it is not assumed to be an
 * array — an error handler that throws is worse than the error it describes.
 */
function reasonOf(error) {
  const details = error?.details;
  if (!Array.isArray(details)) return '';
  return details.find((d) => d?.reason)?.reason || '';
}

/**
 * @returns {{title: string, fix: string, retryable: boolean}}
 */
export function explainFailure(status, error) {
  const message = String(error?.message || '');
  const reason = reasonOf(error);

  if (status === 400 && (reason === 'API_KEY_INVALID' || /API key not valid/i.test(message))) {
    return {
      title: 'That API key was not accepted by Google.',
      fix: 'Check for a stray space or missing character when it was pasted, or create a fresh key in Google AI Studio.',
      retryable: false
    };
  }

  if (status === 403 && (reason === 'SERVICE_DISABLED' || /has not been used|is disabled/i.test(message))) {
    return {
      title: 'Your key is fine, but the Gemini API is switched off for its project.',
      fix: 'Google needs the "Generative Language API" enabled for that project. Easiest fix is to create the key at aistudio.google.com/apikey, which enables it for you.',
      retryable: false
    };
  }

  if (status === 403 && /referer|referrer|blocked|restrict/i.test(message)) {
    return {
      title: 'Your key is restricted and will not work from a browser.',
      fix: 'In Google Cloud, either remove the key\'s application restrictions or add this site to its allowed referrers.',
      retryable: false
    };
  }

  if (status === 403) {
    return {
      title: 'Google refused the request for this key.',
      fix: 'The key exists but is not permitted to use Gemini. Creating a new one at aistudio.google.com/apikey usually clears it.',
      retryable: false
    };
  }

  if (status === 429 || reason === 'RATE_LIMIT_EXCEEDED') {
    return {
      title: "You have hit Google's free usage limit for now.",
      fix: 'Nothing is broken. Free keys reset — try again in a few minutes, or later today.',
      retryable: true
    };
  }

  if (status === 404) {
    return {
      title: 'The coaching model is no longer available.',
      fix: 'Google has retired or renamed it. This needs a one-line change in the app — tell whoever maintains it.',
      retryable: false
    };
  }

  if (status === 503 || /overload/i.test(message)) {
    return {
      title: 'Google is busy right now.',
      fix: 'Nothing to do with your key. Try again in a moment.',
      retryable: true
    };
  }

  if (status >= 500) {
    return {
      title: 'Google had a problem at their end.',
      fix: 'Not your key and not the app. Try again shortly.',
      retryable: true
    };
  }

  return {
    title: `The coach could not be reached (error ${status}).`,
    fix: message ? `Google said: ${message}` : 'Try again in a moment.',
    retryable: true
  };
}

/** One-line version for showing inline in the app. */
export const failureMessage = (status, error) => {
  const { title, fix } = explainFailure(status, error);
  return `${title} ${fix}`;
};
