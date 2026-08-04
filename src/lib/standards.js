/**
 * Standards: the minimum activity the agent holds themselves to, and how far
 * through it they are right now.
 *
 * This adds no counters. Every target here is a number attached to a counter
 * that already exists on the broker's form — a standard is a promise about an
 * existing number, not a new thing to log.
 *
 * Two horizons, because they behave differently:
 *
 *   daily   — the non-negotiables. Small, done in one morning block, binary.
 *             Missing one is a miss; doing double tomorrow does not undo it.
 *   weekly  — quota work. Batched, lumpy, legitimately done in one sitting.
 *             Judged on the week's total, not on any given day.
 *
 * Pace is measured in business days so a Monday morning does not report that
 * the week is already 14% behind, and so a quiet Sunday is not a failure.
 */
import { keyToDate, dateToKey, shiftKey } from './dates.js';
import { ACTIVITY_KEYS, isBlank } from './entries.js';

/**
 * Referral-weighted defaults for a solo agent working a relational database.
 *
 * The shape of it: five calls, two notes and one video every working morning is
 * eight personal touches a day, ~40 a week, ~2,000 a year. Against a worked
 * database that is roughly the contact volume a mid-twenties transaction count
 * needs. The weekly numbers are the touches that don't fit a morning block.
 *
 * These are a starting point, not a law. They are editable in Settings and are
 * meant to be argued with in a coaching session.
 */
// Declared in ACTIVITY_KEYS order — i.e. the broker's form order — so that
// every list built from these keys reads the same way the form does.
export const DEFAULT_STANDARDS = {
  notes: { daily: 2, weekly: 10 },
  calls: { daily: 5, weekly: 25 },
  texts: { daily: 0, weekly: 50 },
  videos: { daily: 1, weekly: 5 },
  socialPosts: { daily: 0, weekly: 5 },
  popBys: { daily: 0, weekly: 5 },
  clientParties: { daily: 0, weekly: 0 },
  coffee: { daily: 0, weekly: 2 }
};

const toTarget = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};

/** Coerce anything into a valid standards record. Never throws. */
export function migrateStandards(raw) {
  const out = {};
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  for (const key of ACTIVITY_KEYS) {
    const fallback = DEFAULT_STANDARDS[key] || { daily: 0, weekly: 0 };
    const given = source[key];
    if (!given || typeof given !== 'object') {
      out[key] = { ...fallback };
      continue;
    }
    out[key] = {
      daily: toTarget(given.daily),
      weekly: toTarget(given.weekly)
    };
  }
  return out;
}

/** True when the agent has set no target at all — used to hide the panel. */
export const hasAnyStandard = (standards) =>
  ACTIVITY_KEYS.some((k) => standards?.[k]?.daily > 0 || standards?.[k]?.weekly > 0);

/** Monday-first day index: Mon=0 ... Sun=6. */
const mondayIndex = (date) => (date.getDay() + 6) % 7;

/** The Monday..Sunday keys of the week containing `key`, oldest first. */
export function weekKeys(key) {
  const monday = shiftKey(key, -mondayIndex(keyToDate(key)));
  return Array.from({ length: 7 }, (_, i) => shiftKey(monday, i));
}

/** True for Mon-Fri. Weekend work still counts toward totals; it just isn't owed. */
export const isBusinessDay = (key) => mondayIndex(keyToDate(key)) < 5;

/**
 * Business days elapsed in the week up to and including `key`, capped at 5.
 * Saturday and Sunday both report 5 — by the weekend the full week is owed.
 */
export function businessDaysElapsed(key) {
  return Math.min(mondayIndex(keyToDate(key)) + 1, 5);
}

/**
 * Today against the daily non-negotiables.
 * Only counters with a daily target appear. `met` is all-or-nothing on purpose:
 * a standard that is 80% kept is a standard that isn't kept.
 */
export function dailyProgress(entry, standards) {
  const items = ACTIVITY_KEYS.filter((key) => standards?.[key]?.daily > 0).map((key) => {
    const target = standards[key].daily;
    const done = entry?.activities?.[key] || 0;
    return { key, done, target, met: done >= target, remaining: Math.max(0, target - done) };
  });

  const totalTarget = items.reduce((sum, i) => sum + i.target, 0);
  const totalDone = items.reduce((sum, i) => sum + Math.min(i.done, i.target), 0);

  return {
    items,
    met: items.length > 0 && items.every((i) => i.met),
    totalTarget,
    totalDone,
    pct: totalTarget ? Math.round((totalDone / totalTarget) * 100) : 0
  };
}

/**
 * The week so far against the weekly quotas.
 * `owed` is what should be done by the end of today, so "behind" means behind
 * *now* rather than behind against Friday's number on a Tuesday.
 */
export function weeklyProgress(entriesByDate, key, standards) {
  const keys = weekKeys(key);
  const elapsed = businessDaysElapsed(key);

  const items = ACTIVITY_KEYS.filter((k) => standards?.[k]?.weekly > 0).map((metric) => {
    const target = standards[metric].weekly;
    let done = 0;
    for (const day of keys) {
      if (day > key) break; // don't count days that haven't happened
      done += entriesByDate[day]?.activities?.[metric] || 0;
    }
    const owed = Math.ceil((target * elapsed) / 5);
    return {
      key: metric,
      done,
      target,
      owed,
      onPace: done >= owed,
      remaining: Math.max(0, target - done),
      pct: target ? Math.min(100, Math.round((done / target) * 100)) : 0
    };
  });

  return {
    items,
    weekStart: keys[0],
    elapsed,
    onPace: items.every((i) => i.onPace),
    behind: items.filter((i) => !i.onPace)
  };
}

/**
 * Consecutive business days ending at `key` where the daily standard was met.
 *
 * Weekends are skipped rather than counted or broken — nobody should lose a
 * streak for not making calls on a Sunday. Today only breaks the streak once
 * it is over: an unfinished today is not yet a failure, so if today is short
 * the count simply starts from yesterday.
 */
export function dailyStreak(entriesByDate, key, standards, lookback = 90) {
  const hasDaily = ACTIVITY_KEYS.some((k) => standards?.[k]?.daily > 0);
  if (!hasDaily) return 0;

  let streak = 0;
  let cursor = key;

  for (let i = 0; i < lookback; i += 1) {
    if (isBusinessDay(cursor)) {
      const entry = entriesByDate[cursor];
      if (entry && !isBlank(entry) && dailyProgress(entry, standards).met) {
        streak += 1;
      } else if (i === 0) {
        // Today is still in play — start counting from yesterday instead.
      } else {
        break;
      }
    }
    cursor = shiftKey(cursor, -1);
  }

  return streak;
}

/** Business days in the last `days` where the daily standard was met. */
export function adherence(entriesByDate, key, standards, days = 14) {
  let owed = 0;
  let met = 0;
  let cursor = key;

  for (let i = 0; i < days; i += 1) {
    if (isBusinessDay(cursor)) {
      owed += 1;
      const entry = entriesByDate[cursor];
      if (entry && !isBlank(entry) && dailyProgress(entry, standards).met) met += 1;
    }
    cursor = shiftKey(cursor, -1);
  }

  return { owed, met, pct: owed ? Math.round((met / owed) * 100) : 0 };
}

/** Today's key, exported here so callers don't reach past this module. */
export const todayForStandards = () => dateToKey(new Date());
