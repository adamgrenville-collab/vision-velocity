/**
 * Shape of a single day's entry, plus migration from older saved shapes.
 *
 * This file exists because the app's storage schema drifted while it was being
 * built, and the previous version tried to survive that with try/catch blocks
 * scattered through a useEffect. Everything that reads saved data goes through
 * `migrateEntry`, which is total: any input, however mangled, produces a valid
 * entry. That guarantee is what the tests pin down.
 */

export const ACTIVITY_KEYS = [
  'clientCheckIns',
  'calls',
  'texts',
  'notes',
  'videos',
  'reSocial',
  'popBys',
  'meetUps'
];

export const PRODUCTION_KEYS = [
  'evaluations',
  'showingsBuyers',
  'showingsListings',
  'listings',
  'pendings',
  'closings'
];

export const ACTION_PLAN_SLOTS = 5;

/** Fields renamed between versions: oldName -> currentName. */
const RENAMED_ACTIVITIES = {
  social: 'reSocial',
  coffee: 'meetUps'
};

export function emptyActionPlan() {
  return Array.from({ length: ACTION_PLAN_SLOTS }, () => ({ text: '', done: false }));
}

export function blankEntry() {
  const activities = {};
  for (const key of ACTIVITY_KEYS) activities[key] = 0;

  const production = {};
  for (const key of PRODUCTION_KEYS) production[key] = 0;

  return {
    mindset: { feeling: '', belief: '', win: '', peakTime: '', roadblock: '' },
    activities,
    production,
    actionPlan: emptyActionPlan(),
    pipeline: ''
  };
}

const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

const toCount = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};

const toText = (v) => (typeof v === 'string' ? v : '');

/**
 * Coerce anything into a valid entry. Never throws.
 */
export function migrateEntry(raw) {
  const entry = blankEntry();
  if (!isObject(raw)) return entry;

  if (isObject(raw.mindset)) {
    for (const key of Object.keys(entry.mindset)) {
      entry.mindset[key] = toText(raw.mindset[key]);
    }
  }

  if (isObject(raw.activities)) {
    for (const key of ACTIVITY_KEYS) {
      entry.activities[key] = toCount(raw.activities[key]);
    }
    // Adopt a legacy value only when the current field was never written.
    for (const [oldKey, newKey] of Object.entries(RENAMED_ACTIVITIES)) {
      if (raw.activities[newKey] === undefined && raw.activities[oldKey] !== undefined) {
        entry.activities[newKey] = toCount(raw.activities[oldKey]);
      }
    }
  }

  if (isObject(raw.production)) {
    for (const key of PRODUCTION_KEYS) {
      entry.production[key] = toCount(raw.production[key]);
    }
  }

  if (Array.isArray(raw.actionPlan)) {
    entry.actionPlan = entry.actionPlan.map((slot, i) => {
      const item = raw.actionPlan[i];
      if (!isObject(item)) return slot;
      return { text: toText(item.text), done: item.done === true };
    });
  }

  entry.pipeline = toText(raw.pipeline);

  return entry;
}

/** Coerce a whole saved map of date -> entry. Never throws. */
export function migrateAll(raw) {
  if (!isObject(raw)) return {};
  const out = {};
  for (const [key, value] of Object.entries(raw)) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(key)) out[key] = migrateEntry(value);
  }
  return out;
}

/** Totals across the given date keys, for the roll-up and the coaching prompt. */
export function summarize(entriesByDate, dateKeys) {
  const totalActivities = {};
  for (const key of ACTIVITY_KEYS) totalActivities[key] = 0;

  const totalProduction = {};
  for (const key of PRODUCTION_KEYS) totalProduction[key] = 0;

  const roadblocks = [];
  const peakTimes = { Morning: 0, Afternoon: 0, Evening: 0 };

  for (const date of dateKeys) {
    const entry = entriesByDate[date];
    if (!entry) continue;
    for (const key of ACTIVITY_KEYS) totalActivities[key] += entry.activities?.[key] || 0;
    for (const key of PRODUCTION_KEYS) totalProduction[key] += entry.production?.[key] || 0;
    if (entry.mindset?.roadblock) roadblocks.push({ date, roadblock: entry.mindset.roadblock });
    const peak = entry.mindset?.peakTime;
    if (peak) peakTimes[peak] = (peakTimes[peak] || 0) + 1;
  }

  return {
    totalActivities,
    totalProduction,
    roadblocks,
    peakTimes,
    conversations: totalActivities.calls + totalActivities.texts
  };
}

/** The most recent N date keys present in storage, newest first. */
export function recentKeys(entriesByDate, count = 7) {
  return Object.keys(entriesByDate).sort().reverse().slice(0, count);
}
