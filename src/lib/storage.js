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
  market: 'velocity_market'
};
