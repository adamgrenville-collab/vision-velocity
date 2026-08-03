import { sign, STATE_TTL_SECONDS } from '../../src/lib/session.js';

/**
 * Step 1 of Google sign-in: send the browser to Google's consent screen.
 *
 * CSRF protection is the standard double-submit: a signed, short-lived `state`
 * goes in the URL AND in a cookie. The callback requires both to match, so a
 * state token lifted from someone else's URL is useless without their browser.
 *
 * Only `openid email profile` is requested — enough to identify the account
 * and show who is signed in. No access to anything in the user's Google data.
 */
export default async (req) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const secret = process.env.SESSION_SECRET;

  if (!clientId || !secret) {
    return new Response('Sign-in is not configured on this deployment.', { status: 503 });
  }

  const origin = new URL(req.url).origin;
  const nonce = crypto.randomUUID();
  const state = await sign({ nonce }, secret, STATE_TTL_SECONDS);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: `${origin}/api/auth/google/callback`,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    // Always land on the account chooser rather than silently reusing a
    // session — this app is used on shared desktops.
    prompt: 'select_account'
  });

  return new Response(null, {
    status: 302,
    headers: {
      Location: `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`,
      'Set-Cookie': [
        `vv_state=${state}`,
        'Path=/',
        'HttpOnly',
        'Secure',
        'SameSite=Lax',
        `Max-Age=${STATE_TTL_SECONDS}`
      ].join('; '),
      'Cache-Control': 'no-store'
    }
  });
};

export const config = { path: '/api/auth/google/start' };
