/**
 * Client-side sync.
 *
 * Local storage stays the source of truth for the running app; the server is a
 * copy that other devices can read. That ordering is deliberate — every feature
 * keeps working with no network, no account, and no server, exactly as it did
 * before sync existed. Sync is additive.
 *
 * The client does the merging (lib/merge.js) and PUTs the result, so there is
 * one merge implementation rather than one on each side that can disagree.
 */
import { mergeAll, differs } from './merge.js';

const EMPTY = { version: 1, entries: {}, sessions: [], profile: {} };

async function getJson(url, options) {
  const response = await fetch(url, { credentials: 'same-origin', ...options });
  if (!response.ok) {
    const error = new Error(`HTTP ${response.status}`);
    error.status = response.status;
    throw error;
  }
  return response.json();
}

/** Who is signed in, and whether this deployment supports sign-in at all. */
export async function whoAmI() {
  try {
    return await getJson('/api/me');
  } catch {
    // No functions deployed (static preview, or an old build) — treat sign-in
    // as simply unavailable rather than surfacing an error.
    return { signedIn: false, configured: false };
  }
}

export async function signOut() {
  try {
    await getJson('/api/me', { method: 'POST' });
  } catch {
    /* clearing the cookie is best-effort */
  }
}

export const startSignIn = () => {
  window.location.href = '/api/auth/google/start';
};

/**
 * Pull the remote document, merge it with local, and push the result back if
 * it changed. Returns the merged document plus what happened.
 */
export async function syncNow(local) {
  let remote;
  try {
    remote = await getJson('/api/data');
  } catch (error) {
    if (error.status === 401) return { status: 'signed-out', data: local };
    return { status: 'offline', data: local };
  }

  const merged = mergeAll(local, remote);

  // Only upload when the merge produced something the server does not have.
  if (!differs(merged, remote)) {
    return { status: 'synced', data: merged, uploaded: false };
  }

  try {
    await getJson('/api/data', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(merged)
    });
    return { status: 'synced', data: merged, uploaded: true };
  } catch (error) {
    // The merge is still valid locally even if the upload failed.
    return { status: error.status === 401 ? 'signed-out' : 'offline', data: merged };
  }
}

/** Shape the app's separate pieces of state into one syncable document. */
export const toDocument = (entries, sessions, profile) => ({
  version: 1,
  entries,
  sessions,
  profile
});

export { EMPTY as EMPTY_DOCUMENT };
