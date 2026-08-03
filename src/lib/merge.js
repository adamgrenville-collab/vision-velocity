/**
 * Merging local and remote data.
 *
 * Sync is the one feature that can destroy work rather than just fail, so the
 * rules here are deliberately conservative:
 *
 *  - Merge is per DAY, not per document. Tallying calls on a phone while a
 *    stale laptop tab is open must never clobber the laptop's other days.
 *  - Within a day, the newer edit wins outright. Field-level merging would be
 *    worse: half a counter from each device is a number that never happened.
 *  - Anything with no timestamp is treated as older than anything with one, so
 *    data written before sync existed never overwrites a real edit.
 *  - Merge is commutative and idempotent: merging twice, or in either order,
 *    gives the same result. The tests pin that down.
 */

const stamp = (item) => {
  const n = Number(item?.updatedAt);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** Whichever of two records was edited more recently. Ties prefer `a`. */
function newer(a, b) {
  if (!a) return b;
  if (!b) return a;
  return stamp(b) > stamp(a) ? b : a;
}

export function mergeEntries(local, remote) {
  const out = {};
  const keys = new Set([...Object.keys(local || {}), ...Object.keys(remote || {})]);
  for (const key of keys) {
    out[key] = newer(local?.[key], remote?.[key]);
  }
  return out;
}

export function mergeSessions(local, remote) {
  const byId = new Map();
  for (const session of local || []) {
    if (session?.id) byId.set(session.id, session);
  }
  for (const session of remote || []) {
    if (!session?.id) continue;
    byId.set(session.id, newer(byId.get(session.id), session));
  }
  return [...byId.values()].sort((a, b) => String(a.date).localeCompare(String(b.date)));
}

/** Settings are small and coupled, so the whole profile moves as one unit. */
export function mergeProfile(local, remote) {
  return newer(local, remote) || {};
}

export function mergeAll(local, remote) {
  return {
    version: 1,
    entries: mergeEntries(local?.entries, remote?.entries),
    sessions: mergeSessions(local?.sessions, remote?.sessions),
    profile: mergeProfile(local?.profile, remote?.profile)
  };
}

/** Did merging change anything the local device did not already have? */
export function differs(a, b) {
  return JSON.stringify(a) !== JSON.stringify(b);
}
