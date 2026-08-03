import {
  sign,
  verify,
  readCookie,
  buildCookie,
  SESSION_TTL_SECONDS
} from '../../src/lib/session.js';

/** Decode a JWT payload without verifying — safe only for a token we just
 *  fetched from Google over TLS, in exchange for our own client secret. */
function decodeIdToken(idToken) {
  const part = String(idToken).split('.')[1];
  if (!part) return null;
  const padded = part.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(part.length / 4) * 4, '=');
  try {
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(padded), (c) => c.charCodeAt(0))));
  } catch {
    return null;
  }
}

const fail = (message) =>
  new Response(
    `<!doctype html><meta charset="utf-8"><title>Sign-in failed</title>` +
      `<body style="font:16px/1.5 system-ui;padding:40px;max-width:32rem">` +
      `<h1 style="font-size:20px">Sign-in didn't complete</h1><p>${message}</p>` +
      `<p><a href="/">Back to the app</a> — your data on this device is untouched.</p>`,
    { status: 400, headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } }
  );

export default async (req) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const sessionSecret = process.env.SESSION_SECRET;

  if (!clientId || !clientSecret || !sessionSecret) {
    return fail('Sign-in is not configured on this deployment.');
  }

  const url = new URL(req.url);
  if (url.searchParams.get('error')) return fail('You cancelled the sign-in.');

  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookieState = readCookie(req.headers.get('cookie'), 'vv_state');

  // Both halves of the double-submit must be present, identical, and validly
  // signed. Anything else and we stop.
  if (!code || !state || !cookieState || state !== cookieState) {
    return fail('The sign-in link was invalid or has expired. Please try again.');
  }
  if (!(await verify(state, sessionSecret))) {
    return fail('The sign-in link has expired. Please try again.');
  }

  let tokens;
  try {
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: `${url.origin}/api/auth/google/callback`,
        grant_type: 'authorization_code'
      })
    });
    tokens = await response.json();
    if (!response.ok) {
      console.error('Google token exchange failed', response.status, tokens?.error);
      return fail('Google rejected the sign-in. Please try again.');
    }
  } catch {
    return fail('Could not reach Google. Please try again.');
  }

  const claims = decodeIdToken(tokens.id_token);
  if (!claims?.sub) return fail('Google did not return an account id.');

  const session = await sign(
    { sub: claims.sub, email: claims.email || '', name: claims.name || '' },
    sessionSecret,
    SESSION_TTL_SECONDS
  );

  return new Response(null, {
    status: 302,
    headers: {
      Location: '/?signedin=1',
      'Cache-Control': 'no-store',
      // Set the session and clear the one-time state in the same response.
      'Set-Cookie': buildCookie(session, SESSION_TTL_SECONDS)
    }
  });
};

export const config = { path: '/api/auth/google/callback' };
