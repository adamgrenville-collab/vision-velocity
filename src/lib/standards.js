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

/** A weekday the agent deliberately booked off. Weekends are never "off" — they're just weekends. */
export const isDayOff = (entriesByDate, key) =>
  isBusinessDay(key) && entriesByDate?.[key]?.dayOff === true;

/**
 * Business days elapsed in the week up to and including `key`, capped at 5.
 * Saturday and Sunday both report 5 — by the weekend the full week is owed.
 */
export function businessDaysElapsed(key) {
  return Math.min(mondayIndex(keyToDate(key)) + 1, 5);
}

/**
 * What the week actually owes, in days: the five business days less any booked
 * off. A four-day week owes four fifths of every quota, so taking Wednesday off
 * doesn't quietly turn the rest of the week amber.
 */
export function weekOwedDays(entriesByDate, key) {
  const days = weekKeys(key).filter(isBusinessDay);
  const off = days.filter((day) => isDayOff(entriesByDate, day)).length;
  return Math.max(0, 5 - off);
}

/** Business days elapsed less those booked off — the numerator for pace. */
export function elapsedOwedDays(entriesByDate, key) {
  const elapsed = weekKeys(key)
    .filter((day) => isBusinessDay(day) && day <= key)
    .filter((day) => !isDayOff(entriesByDate, day));
  // On a weekend, every business day of the week has elapsed.
  return isBusinessDay(key) ? elapsed.length : weekOwedDays(entriesByDate, key);
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
  const elapsed = elapsedOwedDays(entriesByDate, key);
  const owedDays = weekOwedDays(entriesByDate, key);
  const daysOff = 5 - owedDays;

  const items = ACTIVITY_KEYS.filter((k) => standards?.[k]?.weekly > 0).map((metric) => {
    // The full week's target, scaled down if days were booked off. A four-day
    // week is not a five-day week with a shortfall.
    const target = Math.ceil((standards[metric].weekly * owedDays) / 5);
    let done = 0;
    for (const day of keys) {
      if (day > key) break; // don't count days that haven't happened
      // Weekend and day-off activity counts. Working Saturday is still work.
      done += entriesByDate[day]?.activities?.[metric] || 0;
    }
    const owed = owedDays ? Math.ceil((target * elapsed) / owedDays) : 0;
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
    owedDays,
    daysOff,
    onPace: items.every((i) => i.onPace),
    behind: items.filter((i) => !i.onPace),
    // Every quota hit, however unevenly. A week's work done in two days is a
    // week's work done: these touches are not time-sensitive, and the weekly
    // view is where that has to be visible.
    complete: items.length > 0 && items.every((i) => i.done >= i.target),
    // What's left to finish the week. Quotas are batchable, so this is a real
    // to-do list rather than a scold — unlike the daily three, which cannot be
    // caught up and are deliberately absent from it.
    toFinish: items.filter((i) => i.remaining > 0)
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
    const entry = entriesByDate[cursor];
    const met = entry && !isBlank(entry) && dailyProgress(entry, standards).met;
    const owed = isBusinessDay(cursor) && !isDayOff(entriesByDate, cursor);

    if (met) {
      // Counts wherever it happens — a Saturday or a booked-off day that was
      // worked anyway extends the streak. Effort is never penalised.
      streak += 1;
    } else if (owed && i > 0) {
      break;
    }
    // Everything else — an unowed day not worked, or a today still in play —
    // is skipped: neither credit nor a break.
    cursor = shiftKey(cursor, -1);
  }

  return streak;
}

/**
 * How often the standard was actually kept over the last `days`.
 *
 * `owed` counts only business days that weren't booked off, so planned rest
 * never drags the percentage down. `bonus` counts days that were met but never
 * owed — weekend work and days booked off but worked anyway — reported
 * separately so the percentage stays an honest out-of-100.
 */
export function adherence(entriesByDate, key, standards, days = 14) {
  let owed = 0;
  let met = 0;
  let bonus = 0;
  let daysOff = 0;
  let cursor = key;

  for (let i = 0; i < days; i += 1) {
    const entry = entriesByDate[cursor];
    const hit = entry && !isBlank(entry) && dailyProgress(entry, standards).met;
    const off = isDayOff(entriesByDate, cursor);

    if (off) daysOff += 1;

    if (isBusinessDay(cursor) && !off) {
      owed += 1;
      if (hit) met += 1;
    } else if (hit) {
      bonus += 1;
    }
    cursor = shiftKey(cursor, -1);
  }

  return { owed, met, bonus, daysOff, pct: owed ? Math.round((met / owed) * 100) : 0 };
}

/**
 * Which weekday keeps getting missed.
 *
 * Adherence tells you *that* you're at 60%. It doesn't tell you that all of the
 * misses are Fridays, which is the only version of the number you can act on —
 * a weekday that keeps failing is a calendar problem, not a character one.
 *
 * Deliberately not a deficit. It counts how often each weekday was owed and
 * kept, never how many calls are "outstanding". Touches are not time-sensitive
 * and accumulating them into a debt is exactly the framing that makes people
 * abandon a standard.
 *
 * Monday-to-Friday only: weekends and booked-off days are never owed, so they
 * have no adherence to report.
 */
export function weekdayPattern(entriesByDate, key, standards, weeks = 8) {
  const days = Array.from({ length: 5 }, (_, day) => ({
    day,
    owed: 0,
    met: 0,
    daysOff: 0,
    touches: 0,
    pct: null,
    avgTouches: 0
  }));

  let cursor = key;
  for (let i = 0; i < weeks * 7; i += 1) {
    const index = mondayIndex(keyToDate(cursor));
    if (index < 5) {
      const slot = days[index];
      const entry = entriesByDate[cursor];
      const logged = entry && !isBlank(entry);

      if (isDayOff(entriesByDate, cursor)) {
        slot.daysOff += 1;
      } else {
        slot.owed += 1;
        if (logged && dailyProgress(entry, standards).met) slot.met += 1;
      }
      if (logged) {
        slot.touches += ACTIVITY_KEYS.reduce((sum, k) => sum + (entry.activities?.[k] || 0), 0);
      }
    }
    cursor = shiftKey(cursor, -1);
  }

  for (const slot of days) {
    slot.pct = slot.owed ? Math.round((slot.met / slot.owed) * 100) : null;
    slot.avgTouches = slot.owed ? Math.round(slot.touches / slot.owed) : 0;
  }

  // Only call out a weak day once there's enough of it to be a pattern rather
  // than a bad week, and only when some other day is meaningfully better.
  const rated = days.filter((d) => d.owed >= 3);
  const worst = rated.reduce((a, b) => (a === null || b.pct < a.pct ? b : a), null);
  const best = rated.reduce((a, b) => (a === null || b.pct > a.pct ? b : a), null);
  const weakest = worst && best && best.pct - worst.pct >= 25 ? worst : null;

  return { days, weakest, weeks, hasData: days.some((d) => d.owed > 0) };
}

/** Today's key, exported here so callers don't reach past this module. */
export const todayForStandards = () => dateToKey(new Date());
