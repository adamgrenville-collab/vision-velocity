import { verify, readCookie, clearCookie, COOKIE_NAME } from '../../src/lib/session.js';

const json = (body, status = 200, extraHeaders = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...extraHeaders }
  });

/**
 * Who is signed in, and sign out.
 *
 * GET  -> { signedIn, email, name, configured }
 * POST -> clears the session cookie
 *
 * `configured` tells the client whether this deployment has sign-in set up at
 * all, so the UI can hide the button rather than offer something that 503s.
 */
export default async (req) => {
  const secret = process.env.SESSION_SECRET;
  const configured = Boolean(secret && process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

  if (req.method === 'POST') {
    return json({ signedIn: false, configured }, 200, { 'Set-Cookie': clearCookie() });
  }

  if (!configured) return json({ signedIn: false, configured: false });

  const payload = await verify(readCookie(req.headers.get('cookie'), COOKIE_NAME), secret);
  if (!payload) return json({ signedIn: false, configured: true });

  return json({ signedIn: true, configured: true, email: payload.email || '', name: payload.name || '' });
};

export const config = { path: '/api/me' };
