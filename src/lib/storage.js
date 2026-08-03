/**
 * localStorage that cannot throw.
 *
 * Safari in Private Browsing throws on setItem, and a full quota throws on any
 * write. Neither should ever take the app down, so every access is guarded and
 * failures degrade to "this session just won't persist".
 */

export function readRaw(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeRaw(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function remove(key) {
  try {
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export function readJson(key, fallback) {
  const raw = readRaw(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function writeJson(key, value) {
  try {
    return writeRaw(key, JSON.stringify(value));
  } catch {
    return false;
  }
}

export const KEYS = {
  entries: 'velocity_daily_entries',
  apiKey: 'velocity_api_key',
  market: 'velocity_market',
  name: 'velocity_name',
  sessions: 'velocity_sessions',
  goals: 'velocity_goals',
  // Name, market and goals as one record, so they can carry a single
  // last-edited stamp for merging. The three keys above are read once for
  // anyone upgrading from before this existed.
  profile: 'velocity_profile'
};

/** Name/market/goals, preferring the combined record, falling back to legacy keys. */
export function readProfile() {
  const combined = readJson(KEYS.profile, null);
  if (combined && typeof combined === 'object') {
    return {
      name: typeof combined.name === 'string' ? combined.name : '',
      market: typeof combined.market === 'string' ? combined.market : '',
      goals: Array.isArray(combined.goals) ? combined.goals : [],
      updatedAt: Number(combined.updatedAt) || 0
    };
  }
  const goals = readJson(KEYS.goals, []);
  return {
    name: readRaw(KEYS.name) || '',
    market: readRaw(KEYS.market) || '',
    goals: Array.isArray(goals) ? goals : [],
    updatedAt: 0
  };
}
