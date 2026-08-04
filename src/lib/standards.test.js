import { describe, it, expect } from 'vitest';
import { blankEntry, migrateEntry, isBlank } from './entries.js';
import {
  DEFAULT_STANDARDS,
  migrateStandards,
  hasAnyStandard,
  weekKeys,
  isBusinessDay,
  isDayOff,
  businessDaysElapsed,
  dailyProgress,
  weeklyProgress,
  dailyStreak,
  adherence
} from './standards.js';

// 2026-08-03 is a Monday, 2026-08-07 a Friday, 2026-08-09 a Sunday.
const MON = '2026-08-03';
const TUE = '2026-08-04';
const WED = '2026-08-05';
const THU = '2026-08-06';
const FRI = '2026-08-07';
const SAT = '2026-08-08';
const SUN = '2026-08-09';

const entryWith = (activities) => ({ ...blankEntry(), activities: { ...blankEntry().activities, ...activities } });
const fullDay = () => entryWith({ calls: 5, notes: 2, videos: 1 });
const dayOff = () => ({ ...blankEntry(), dayOff: true });

describe('migrateStandards', () => {
  it('returns the defaults for junk input', () => {
    for (const junk of [null, undefined, 0, 'nope', [], NaN]) {
      expect(migrateStandards(junk)).toEqual(DEFAULT_STANDARDS);
    }
  });

  it('keeps every activity key even when only one is supplied', () => {
    const out = migrateStandards({ calls: { daily: 10, weekly: 50 } });
    expect(out.calls).toEqual({ daily: 10, weekly: 50 });
    expect(out.notes).toEqual(DEFAULT_STANDARDS.notes);
    expect(Object.keys(out)).toEqual(Object.keys(DEFAULT_STANDARDS));
  });

  it('floors negatives and non-numbers to zero', () => {
    const out = migrateStandards({ calls: { daily: -4, weekly: 'ten' }, notes: 'nope' });
    expect(out.calls).toEqual({ daily: 0, weekly: 0 });
    expect(out.notes).toEqual(DEFAULT_STANDARDS.notes);
  });

  it('never adds a key that is not a real counter', () => {
    const out = migrateStandards({ doorKnocks: { daily: 20, weekly: 100 } });
    expect(out.doorKnocks).toBeUndefined();
  });

  it('detects an all-zero standard', () => {
    expect(hasAnyStandard(DEFAULT_STANDARDS)).toBe(true);
    expect(hasAnyStandard(migrateStandards({ calls: { daily: 0, weekly: 0 } }))).toBe(true);
    const none = Object.fromEntries(Object.keys(DEFAULT_STANDARDS).map((k) => [k, { daily: 0, weekly: 0 }]));
    expect(hasAnyStandard(none)).toBe(false);
    expect(hasAnyStandard(null)).toBe(false);
  });
});

describe('week maths', () => {
  it('starts the week on Monday from any day in it', () => {
    const expected = [MON, TUE, WED, THU, FRI, SAT, SUN];
    for (const day of expected) expect(weekKeys(day)).toEqual(expected);
  });

  it('treats Monday through Friday as business days', () => {
    expect([MON, TUE, WED, THU, FRI].every(isBusinessDay)).toBe(true);
    expect(isBusinessDay(SAT)).toBe(false);
    expect(isBusinessDay(SUN)).toBe(false);
  });

  it('counts business days elapsed, capping at five over the weekend', () => {
    expect(businessDaysElapsed(MON)).toBe(1);
    expect(businessDaysElapsed(WED)).toBe(3);
    expect(businessDaysElapsed(FRI)).toBe(5);
    expect(businessDaysElapsed(SAT)).toBe(5);
    expect(businessDaysElapsed(SUN)).toBe(5);
  });

  it('crosses a month boundary without drifting', () => {
    // 2026-09-01 is a Tuesday, so its week starts in August.
    expect(weekKeys('2026-09-01')[0]).toBe('2026-08-31');
  });
});

describe('dailyProgress', () => {
  it('only reports counters that carry a daily target', () => {
    // Form order, not the order the defaults happen to be typed in.
    const { items } = dailyProgress(blankEntry(), DEFAULT_STANDARDS);
    expect(items.map((i) => i.key)).toEqual(['notes', 'calls', 'videos']);
  });

  it('is all-or-nothing', () => {
    expect(dailyProgress(entryWith({ calls: 5, notes: 2, videos: 0 }), DEFAULT_STANDARDS).met).toBe(false);
    expect(dailyProgress(fullDay(), DEFAULT_STANDARDS).met).toBe(true);
  });

  it('does not let one counter overflow into another', () => {
    // 50 calls is not two notes.
    const over = dailyProgress(entryWith({ calls: 50 }), DEFAULT_STANDARDS);
    expect(over.met).toBe(false);
    expect(over.totalDone).toBe(5);
    expect(over.pct).toBe(63);
  });

  it('reports what is left', () => {
    const { items } = dailyProgress(entryWith({ calls: 2 }), DEFAULT_STANDARDS);
    expect(items.find((i) => i.key === 'calls').remaining).toBe(3);
  });

  it('is never met when no daily standard exists', () => {
    const weeklyOnly = migrateStandards(
      Object.fromEntries(Object.keys(DEFAULT_STANDARDS).map((k) => [k, { daily: 0, weekly: 25 }]))
    );
    expect(dailyProgress(fullDay(), weeklyOnly).met).toBe(false);
  });

  it('survives a missing entry', () => {
    expect(dailyProgress(undefined, DEFAULT_STANDARDS).pct).toBe(0);
  });
});

describe('weeklyProgress', () => {
  const entries = { [MON]: entryWith({ calls: 10, texts: 20 }), [TUE]: entryWith({ calls: 6 }) };

  it('totals the week to date and ignores days that have not happened', () => {
    const later = { ...entries, [FRI]: entryWith({ calls: 99 }) };
    const calls = weeklyProgress(later, TUE, DEFAULT_STANDARDS).items.find((i) => i.key === 'calls');
    expect(calls.done).toBe(16);
  });

  it('owes only the elapsed share of the week', () => {
    const onMon = weeklyProgress(entries, MON, DEFAULT_STANDARDS).items.find((i) => i.key === 'calls');
    expect(onMon.owed).toBe(5);
    expect(onMon.onPace).toBe(true);

    const onFri = weeklyProgress(entries, FRI, DEFAULT_STANDARDS).items.find((i) => i.key === 'calls');
    expect(onFri.owed).toBe(25);
    expect(onFri.onPace).toBe(false);
    expect(onFri.remaining).toBe(9);
  });

  it('caps percentage at 100 for an overshoot', () => {
    const big = weeklyProgress({ [MON]: entryWith({ coffee: 9 }) }, MON, DEFAULT_STANDARDS);
    expect(big.items.find((i) => i.key === 'coffee').pct).toBe(100);
  });

  it('lists exactly what is behind', () => {
    const week = weeklyProgress(entries, FRI, DEFAULT_STANDARDS);
    expect(week.onPace).toBe(false);
    expect(week.behind.map((i) => i.key)).toContain('calls');
    expect(week.weekStart).toBe(MON);
  });

  it('omits counters with no weekly target', () => {
    const week = weeklyProgress(entries, TUE, DEFAULT_STANDARDS);
    expect(week.items.map((i) => i.key)).not.toContain('clientParties');
  });
});

describe('dailyStreak', () => {
  it('counts consecutive met business days', () => {
    const entries = { [MON]: fullDay(), [TUE]: fullDay(), [WED]: fullDay() };
    expect(dailyStreak(entries, WED, DEFAULT_STANDARDS)).toBe(3);
  });

  it('does not punish an unfinished today', () => {
    const entries = { [MON]: fullDay(), [TUE]: fullDay(), [WED]: entryWith({ calls: 1 }) };
    expect(dailyStreak(entries, WED, DEFAULT_STANDARDS)).toBe(2);
  });

  it('skips the weekend rather than breaking on it', () => {
    const entries = { [THU]: fullDay(), [FRI]: fullDay(), '2026-08-10': fullDay() };
    expect(dailyStreak(entries, '2026-08-10', DEFAULT_STANDARDS)).toBe(3);
  });

  it('breaks on a missed business day', () => {
    const entries = { [MON]: fullDay(), [TUE]: entryWith({ calls: 5 }), [WED]: fullDay() };
    expect(dailyStreak(entries, WED, DEFAULT_STANDARDS)).toBe(1);
  });

  it('treats a blank day as a miss, not as absent', () => {
    const entries = { [MON]: fullDay(), [TUE]: blankEntry(), [WED]: fullDay() };
    expect(dailyStreak(entries, WED, DEFAULT_STANDARDS)).toBe(1);
  });

  it('is zero with no standards and with no data', () => {
    const none = Object.fromEntries(Object.keys(DEFAULT_STANDARDS).map((k) => [k, { daily: 0, weekly: 0 }]));
    expect(dailyStreak({ [WED]: fullDay() }, WED, none)).toBe(0);
    expect(dailyStreak({}, WED, DEFAULT_STANDARDS)).toBe(0);
  });
});

describe('adherence', () => {
  it('scores met business days against owed ones', () => {
    const entries = { [MON]: fullDay(), [TUE]: fullDay(), [WED]: entryWith({ calls: 5 }) };
    // Mon-Wed is three business days owed, two met.
    const score = adherence(entries, WED, DEFAULT_STANDARDS, 3);
    expect(score).toMatchObject({ owed: 3, met: 2, pct: 67 });
  });

  it('never owes a weekend', () => {
    expect(adherence({}, SUN, DEFAULT_STANDARDS, 2).owed).toBe(0);
  });

  it('counts weekend work as a bonus, outside the percentage', () => {
    const entries = { [FRI]: fullDay(), [SAT]: fullDay(), [SUN]: fullDay() };
    const score = adherence(entries, SUN, DEFAULT_STANDARDS, 3);
    expect(score).toMatchObject({ owed: 1, met: 1, bonus: 2, pct: 100 });
  });

  it('does not owe a booked-off day', () => {
    const entries = { [MON]: fullDay(), [TUE]: dayOff(), [WED]: fullDay() };
    const score = adherence(entries, WED, DEFAULT_STANDARDS, 3);
    expect(score).toMatchObject({ owed: 2, met: 2, daysOff: 1, pct: 100 });
  });

  it('credits a booked-off day that was worked anyway as bonus', () => {
    const entries = { [MON]: fullDay(), [TUE]: { ...fullDay(), dayOff: true }, [WED]: fullDay() };
    const score = adherence(entries, WED, DEFAULT_STANDARDS, 3);
    expect(score).toMatchObject({ owed: 2, met: 2, bonus: 1, pct: 100 });
  });
});

describe('deliberate days off', () => {
  it('is only a weekday concept — a weekend is never "off"', () => {
    expect(isDayOff({ [TUE]: dayOff() }, TUE)).toBe(true);
    expect(isDayOff({ [SAT]: dayOff() }, SAT)).toBe(false);
    expect(isDayOff({ [TUE]: fullDay() }, TUE)).toBe(false);
    expect(isDayOff({}, TUE)).toBe(false);
  });

  it('survives a round trip through migration', () => {
    expect(migrateEntry({ dayOff: true }).dayOff).toBe(true);
    expect(migrateEntry({ dayOff: 'yes' }).dayOff).toBe(false);
    expect(migrateEntry({}).dayOff).toBe(false);
  });

  it('is never treated as a blank day, or it would not persist', () => {
    expect(isBlank(dayOff())).toBe(false);
    expect(isBlank(blankEntry())).toBe(true);
  });

  it('does not break a streak', () => {
    const entries = { [MON]: fullDay(), [TUE]: dayOff(), [WED]: fullDay() };
    expect(dailyStreak(entries, WED, DEFAULT_STANDARDS)).toBe(2);
  });

  it('shrinks what the week owes rather than creating a shortfall', () => {
    const off = { [WED]: dayOff() };
    const week = weeklyProgress(off, FRI, DEFAULT_STANDARDS);
    expect(week.owedDays).toBe(4);
    expect(week.daysOff).toBe(1);
    // 25 calls over five days becomes 20 over four.
    expect(week.items.find((i) => i.key === 'calls').target).toBe(20);
  });

  it('does not punish the days around it', () => {
    // Mon and Tue at standard, Wed booked off. On Wednesday the week owes two
    // days of quota, and two days of calls have been made.
    const entries = { [MON]: entryWith({ calls: 10 }), [TUE]: entryWith({ calls: 10 }), [WED]: dayOff() };
    const week = weeklyProgress(entries, WED, DEFAULT_STANDARDS);
    expect(week.elapsed).toBe(2);
    expect(week.items.find((i) => i.key === 'calls').onPace).toBe(true);
  });

  it('owes nothing at all in a week taken entirely off', () => {
    const entries = Object.fromEntries([MON, TUE, WED, THU, FRI].map((d) => [d, dayOff()]));
    const week = weeklyProgress(entries, FRI, DEFAULT_STANDARDS);
    expect(week.owedDays).toBe(0);
    expect(week.onPace).toBe(true);
    expect(week.items.every((i) => i.owed === 0)).toBe(true);
  });
});

describe('weekend work', () => {
  it('counts toward the weekly quota', () => {
    const entries = { [SAT]: entryWith({ popBys: 5 }) };
    const week = weeklyProgress(entries, SUN, DEFAULT_STANDARDS);
    expect(week.items.find((i) => i.key === 'popBys').done).toBe(5);
  });

  it('extends a streak when the standard is met', () => {
    const entries = { [FRI]: fullDay(), [SAT]: fullDay(), [SUN]: fullDay() };
    expect(dailyStreak(entries, SUN, DEFAULT_STANDARDS)).toBe(3);
  });

  it('still never breaks one when it is not', () => {
    const entries = { [THU]: fullDay(), [FRI]: fullDay(), [SAT]: entryWith({ calls: 1 }) };
    expect(dailyStreak(entries, SAT, DEFAULT_STANDARDS)).toBe(2);
  });
});

describe('toFinish', () => {
  it('lists only what is left, and never a daily non-negotiable', () => {
    const entries = { [MON]: entryWith({ calls: 25, texts: 50, popBys: 5, socialPosts: 5, coffee: 2, notes: 10 }) };
    const week = weeklyProgress(entries, MON, DEFAULT_STANDARDS);
    // Everything above is complete; videos alone remain.
    expect(week.toFinish.map((i) => i.key)).toEqual(['videos']);
  });

  it('is empty on a finished week', () => {
    const done = entryWith({
      notes: 10, calls: 25, texts: 50, videos: 5, socialPosts: 5, popBys: 5, coffee: 2
    });
    expect(weeklyProgress({ [MON]: done }, FRI, DEFAULT_STANDARDS).toFinish).toEqual([]);
  });
});
