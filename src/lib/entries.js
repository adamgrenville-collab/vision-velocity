/**
 * Shape of a single day's entry, plus migration from older saved shapes.
 *
 * The field list is not arbitrary — it mirrors the "Vision & Velocity Business
 * Coaching" form the agent fills in with their broker each session. Activity and
 * production keys exist so the session snapshot can total themselves instead of
 * being reconstructed from memory. Don't add a counter that isn't on that form,
 * and don't rename one without a migration.
 *
 * `migrateEntry` is total: any input, however mangled, produces a valid entry.
 * That guarantee is what the tests pin down.
 */

// Form: "Notes / Calls / Texts / Videos / Social Posts / Pop-Bys / Client Parties / Coffee"
export const ACTIVITY_KEYS = [
  'notes',
  'calls',
  'texts',
  'videos',
  'socialPosts',
  'popBys',
  'clientParties',
  'coffee'
];

/**
 * Form: "Year to Date: # Active Listings / # Pendings / # Closings".
 *
 * `leases` has no dedicated box on that form, but the box is free text and the
 * agent already writes rentals into it by hand ("4 (2 rental, 2 sfr)"). Leases
 * are roughly a third of his sides in a good year, so a counter that cannot
 * see them cannot see the business. It is appended to the form answer only
 * when there is something to report.
 */
export const PRODUCTION_KEYS = ['listings', 'pendings', 'closings', 'leases'];

/** A lease is real work and a real client, at about half the fee of a sale. */
export const LEASE_WEIGHT = 0.5;

/** Sides, counting a lease as half. The number the annual target is set in. */
export const weightedSides = (production) =>
  (production?.closings || 0) + (production?.leases || 0) * LEASE_WEIGHT;

// Form: "Action Plan — three clear actions"
export const ACTION_PLAN_SLOTS = 3;

/**
 * Counters renamed across versions: oldName -> currentName.
 * `clientCheckIns` is deliberately absent — it was never on the coaching form
 * and is dropped rather than carried forward.
 */
const RENAMED_ACTIVITIES = {
  social: 'socialPosts',
  reSocial: 'socialPosts',
  meetUps: 'coffee'
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
    mindset: { feeling: '', win: '', roadblock: '' },
    activities,
    production,
    // The three actions committed to FOR this day. Set the evening before.
    actionPlan: emptyActionPlan(),
    // A weekday deliberately taken off. Not a miss: it is excused from the
    // daily standard and removed from what the week owes. Rest that was
    // planned is part of the job; only unplanned absence is a gap.
    dayOff: false,
    notes: '',
    // Epoch ms of the last edit, used to merge devices. 0 means "written
    // before sync existed", which loses to any real edit — see lib/merge.js.
    updatedAt: 0
  };
}

const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);

const toCount = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};

const toText = (v) => (typeof v === 'string' ? v : '');

/** Coerce anything into a valid entry. Never throws. */
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

  entry.dayOff = raw.dayOff === true;
  entry.notes = toText(raw.notes) || toText(raw.pipeline);
  entry.updatedAt = toCount(raw.updatedAt);

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

/** True when nothing has been logged — used to keep untouched days out of storage. */
export function isBlank(entry) {
  if (!entry) return true;
  // Marking a day off is a decision, not an absence. If this returned true the
  // flag would never be written and the day would come back as a miss.
  if (entry.dayOff) return false;
  const noCounts =
    ACTIVITY_KEYS.every((k) => !entry.activities?.[k]) &&
    PRODUCTION_KEYS.every((k) => !entry.production?.[k]);
  const noText =
    !entry.mindset?.feeling && !entry.mindset?.win && !entry.mindset?.roadblock && !entry.notes;
  const noPlan = (entry.actionPlan || []).every((i) => !i.text && !i.done);
  return noCounts && noText && noPlan;
}

/** Totals across the given date keys, for the roll-up and the session snapshot. */
export function summarize(entriesByDate, dateKeys) {
  const totalActivities = {};
  for (const key of ACTIVITY_KEYS) totalActivities[key] = 0;

  const totalProduction = {};
  for (const key of PRODUCTION_KEYS) totalProduction[key] = 0;

  const roadblocks = [];
  let daysLogged = 0;
  let targetsSet = 0;
  let targetsDone = 0;

  for (const date of dateKeys) {
    const entry = entriesByDate[date];
    if (!entry || isBlank(entry)) continue;
    daysLogged += 1;

    for (const key of ACTIVITY_KEYS) totalActivities[key] += entry.activities?.[key] || 0;
    for (const key of PRODUCTION_KEYS) totalProduction[key] += entry.production?.[key] || 0;
    if (entry.mindset?.roadblock) roadblocks.push({ date, roadblock: entry.mindset.roadblock });

    for (const item of entry.actionPlan || []) {
      if (!item.text) continue;
      targetsSet += 1;
      if (item.done) targetsDone += 1;
    }
  }

  const conversations = totalActivities.calls + totalActivities.texts;
  const totalActivity = ACTIVITY_KEYS.reduce((sum, key) => sum + totalActivities[key], 0);

  return {
    totalActivities,
    totalProduction,
    roadblocks,
    daysLogged,
    targetsSet,
    targetsDone,
    conversations,
    totalActivity,
    weightedSides: weightedSides(totalProduction)
  };
}

/** Every date key in a window ending at `endKey`, oldest first. */
export function keysInWindow(endKey, days) {
  const out = [];
  const [y, m, d] = String(endKey).split('-').map(Number);
  for (let i = days - 1; i >= 0; i -= 1) {
    const date = new Date(y, m - 1, d - i);
    out.push(
      date.getFullYear() +
        '-' +
        String(date.getMonth() + 1).padStart(2, '0') +
        '-' +
        String(date.getDate()).padStart(2, '0')
    );
  }
  return out;
}

/** The most recent N date keys present in storage, newest first. */
export function recentKeys(entriesByDate, count = 7) {
  return Object.keys(entriesByDate).sort().reverse().slice(0, count);
}
