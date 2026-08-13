import { getStore } from '@netlify/blobs';
import { verify, readCookie, COOKIE_NAME } from '../../src/lib/session.js';

/**
 * Notes a mentor has left, read by the agent they were left for.
 *
 * Notes live in their own record rather than inside the synced document. The
 * agent's app replaces that document wholesale on every save, so a note written
 * by a mentor mid-afternoon would be destroyed by the next thing the agent
 * typed. Keeping them separate means the two writers never touch the same key.
 */

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });

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

  try {
    const notes = (await store.get(`notes/${payload.sub}.json`, { type: 'json' })) || [];
    return json({ notes });
  } catch {
    return json({ error: 'read_failed' }, 502);
  }
};

export const config = { path: '/api/notes' };
