import { getStore } from '@netlify/blobs';
import { verify, readCookie, COOKIE_NAME } from '../../src/lib/session.js';

/**
 * The synced document for the signed-in user.
 *
 * GET  -> the stored document, or an empty one
 * PUT  -> replaces it
 *
 * Storage is keyed by the Google account id from the signed session cookie, so
 * a user can only ever reach their own record — there is no id in the request
 * for an attacker to change.
 *
 * The server does NOT merge. The client merges (src/lib/merge.js, heavily
 * tested) and PUTs the result, so merge behaviour is identical offline and
 * online, and there is one implementation to reason about rather than two.
 */

const MAX_BYTES = 2 * 1024 * 1024;

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });

const EMPTY = { version: 1, entries: {}, sessions: [], profile: {} };

export default async (req) => {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return json({ error: 'not_configured' }, 503);

  const payload = await verify(readCookie(req.headers.get('cookie'), COOKIE_NAME), secret);
  if (!payload?.sub) return json({ error: 'not_signed_in' }, 401);

  let store;
  try {
    store = getStore('vv-user-data');
  } catch {
    return json({ error: 'storage_unavailable' }, 503);
  }

  const key = `user/${payload.sub}.json`;

  if (req.method === 'GET') {
    try {
      const stored = await store.get(key, { type: 'json' });
      return json(stored || EMPTY);
    } catch {
      return json({ error: 'read_failed' }, 502);
    }
  }

  if (req.method === 'PUT') {
    const body = await req.text();
    if (body.length > MAX_BYTES) return json({ error: 'too_large' }, 413);

    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch {
      return json({ error: 'bad_json' }, 400);
    }

    // Shape check. Storing something malformed would break every future read
    // for this user, so reject rather than persist it.
    if (
      !parsed ||
      typeof parsed !== 'object' ||
      typeof parsed.entries !== 'object' ||
      parsed.entries === null ||
      !Array.isArray(parsed.sessions)
    ) {
      return json({ error: 'bad_shape' }, 400);
    }

    try {
      await store.setJSON(key, {
        version: 1,
        entries: parsed.entries,
        sessions: parsed.sessions,
        profile: parsed.profile && typeof parsed.profile === 'object' ? parsed.profile : {}
      });
    } catch {
      return json({ error: 'write_failed' }, 502);
    }

    return json({ ok: true });
  }

  return json({ error: 'method_not_allowed' }, 405);
};

export const config = { path: '/api/data' };
