import { getStore } from '@netlify/blobs';
import { buildSnapshot, isToken, cleanNote, addNote } from '../../src/lib/share.js';

/**
 * What a mentor holding a share link can do.
 *
 * GET  ?token=… — read the agent's snapshot
 * POST ?token=… — leave a note
 *
 * The token is a capability: holding it is the whole authorisation, so it is
 * validated for shape before it is ever used as a storage key, and the reply
 * is a built snapshot rather than the stored record. Nothing here can reach
 * another agent's data, and nothing here can write to the agent's own document
 * — notes live in their own record so the agent's app can never clobber them
 * with a routine save.
 */

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });

const NOTES_PER_DAY = 40;

export default async (req) => {
  const url = new URL(req.url);
  const token = url.searchParams.get('token');

  // Shape-check before the token is used to build a key.
  if (!isToken(token)) return json({ error: 'bad_link' }, 404);

  let store;
  try {
    store = getStore('vv-user-data');
  } catch {
    return json({ error: 'storage_unavailable' }, 503);
  }

  let mapping;
  try {
    mapping = await store.get(`share/${token}.json`, { type: 'json' });
  } catch {
    return json({ error: 'read_failed' }, 502);
  }

  // A revoked link and a link that never existed answer identically — there is
  // nothing to learn by probing.
  if (!mapping?.sub) return json({ error: 'bad_link' }, 404);

  if (req.method === 'GET') {
    let doc;
    try {
      doc = await store.get(`user/${mapping.sub}.json`, { type: 'json' });
    } catch {
      return json({ error: 'read_failed' }, 502);
    }

    // The agent's own local date is not knowable here; UTC is at worst a few
    // hours out, and the cycle is driven by session dates rather than by this.
    const today = new Date().toISOString().slice(0, 10);
    let notes = [];
    try {
      notes = (await store.get(`notes/${mapping.sub}.json`, { type: 'json' })) || [];
    } catch {
      /* notes are not essential to reading the snapshot */
    }

    return json({ snapshot: buildSnapshot(doc, today), notes });
  }

  if (req.method === 'POST') {
    let body;
    try {
      body = await req.json();
    } catch {
      return json({ error: 'bad_request' }, 400);
    }

    const note = cleanNote(body, Date.now());
    if (!note) return json({ error: 'empty_note' }, 400);

    const day = new Date().toISOString().slice(0, 10);
    const counterKey = `noteCount/${token}/${day}`;
    try {
      const used = Number(await store.get(counterKey)) || 0;
      if (used >= NOTES_PER_DAY) return json({ error: 'rate_limited' }, 429);
      await store.set(counterKey, String(used + 1));
    } catch {
      return json({ error: 'rate_limit_unavailable' }, 503);
    }

    try {
      const existing = (await store.get(`notes/${mapping.sub}.json`, { type: 'json' })) || [];
      await store.setJSON(`notes/${mapping.sub}.json`, addNote(existing, note));
    } catch {
      return json({ error: 'write_failed' }, 502);
    }

    return json({ ok: true, note });
  }

  return json({ error: 'method_not_allowed' }, 405);
};

export const config = { path: '/api/shared' };
