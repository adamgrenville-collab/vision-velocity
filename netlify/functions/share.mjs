import { getStore } from '@netlify/blobs';
import { verify, readCookie, COOKIE_NAME } from '../../src/lib/session.js';
import { newToken } from '../../src/lib/share.js';

/**
 * The agent's own control over their share link.
 *
 * GET    — what link exists, if any
 * POST   — create one, or rotate it (which instantly kills the old one)
 * DELETE — turn sharing off
 *
 * Only ever acts on the account in the signed cookie, so an agent can neither
 * read nor revoke anyone else's link.
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

  const ownerKey = `shareOf/${payload.sub}.json`;

  const readOwn = async () => {
    try {
      return await store.get(ownerKey, { type: 'json' });
    } catch {
      return null;
    }
  };

  if (req.method === 'GET') {
    const existing = await readOwn();
    return json({ sharing: Boolean(existing?.token), token: existing?.token || null });
  }

  if (req.method === 'POST') {
    const existing = await readOwn();
    // Rotating must invalidate the previous link immediately — otherwise
    // "make a new link" would quietly leave the old one working.
    if (existing?.token) {
      try {
        await store.delete(`share/${existing.token}.json`);
      } catch {
        /* the mapping may already be gone */
      }
    }

    const token = newToken();
    try {
      await store.setJSON(`share/${token}.json`, { sub: payload.sub, createdAt: Date.now() });
      await store.setJSON(ownerKey, { token, createdAt: Date.now() });
    } catch {
      return json({ error: 'write_failed' }, 502);
    }
    return json({ sharing: true, token });
  }

  if (req.method === 'DELETE') {
    const existing = await readOwn();
    try {
      if (existing?.token) await store.delete(`share/${existing.token}.json`);
      await store.delete(ownerKey);
    } catch {
      return json({ error: 'write_failed' }, 502);
    }
    return json({ sharing: false, token: null });
  }

  return json({ error: 'method_not_allowed' }, 405);
};

export const config = { path: '/api/share' };
