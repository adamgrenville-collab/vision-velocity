import { describe, it, expect } from 'vitest';
import {
  blankGoal,
  migrateGoal,
  migrateGoals,
  periodRange,
  measure,
  tabulate,
  groupByPeriod,
  goalsNarrative,
  paceLabel,
  METRICS
} from './goals.js';
import { migrateEntry } from './entries.js';

const goal = (over = {}) => migrateGoal({ label: 'Goal', ...over });

const day = ({ closings = 0, leases = 0, listings = 0, calls = 0 } = {}) =>
  migrateEntry({ production: { closings, leases, listings }, activities: { calls } });

describe('migrateGoal — never throws', () => {
  for (const bad of [undefined, null, 0, 'x', [], true, { metric: 'nonsense' }, { period: 'weekly' }]) {
    it(`survives ${JSON.stringify(bad) ?? String(bad)}`, () => {
      const g = migrateGoal(bad);
      expect(typeof g.label).toBe('string');
      expect(METRICS.some((m) => m.key === g.metric)).toBe(true);
      expect(['month', 'quarter', 'year', 'custom']).toContain(g.period);
    });
  }

  it('keeps a valid metric and period', () => {
    const g = migrateGoal({ label: 'Sides', metric: 'sides', period: 'quarter', target: 6 });
    expect(g.metric).toBe('sides');
    expect(g.period).toBe('quarter');
    expect(g.target).toBe(6);
  });

  it('rescues a goal from the old version rather than zeroing it', () => {
    // Old shape: label + typed current + target, no metric.
    const g = migrateGoal({ label: 'Gym', current: 14, target: 40 });
    expect(g.metric).toBe('manual');
    expect(g.manualCurrent).toBe(14);
    expect(g.target).toBe(40);
  });

  it('drops goals with no label', () => {
    expect(migrateGoals([{ label: '' }, { label: 'Real' }, null])).toHaveLength(1);
  });

  it('returns empty for non-arrays', () => {
    expect(migrateGoals(null)).toEqual([]);
    expect(migrateGoals({})).toEqual([]);
  });
});

describe('periodRange', () => {
  const at = '2026-08-14';

  it('covers the calendar month', () => {
    expect(periodRange(goal({ period: 'month' }), at)).toEqual({
      start: '2026-08-01',
      end: '2026-08-31'
    });
  });

  it('covers the calendar quarter', () => {
    expect(periodRange(goal({ period: 'quarter' }), at)).toEqual({
      start: '2026-07-01',
      end: '2026-09-30'
    });
  });

  it('covers the calendar year', () => {
    expect(periodRange(goal({ period: 'year' }), at)).toEqual({
      start: '2026-01-01',
      end: '2026-12-31'
    });
  });

  it('honours an explicit long range', () => {
    const g = goal({ period: 'custom', start: '2026-01-01', end: '2028-12-31' });
    expect(periodRange(g, at)).toEqual({ start: '2026-01-01', end: '2028-12-31' });
  });

  it('falls back to the year when a custom range is incomplete', () => {
    expect(periodRange(goal({ period: 'custom', start: '2026-01-01' }), at).end).toBe('2026-12-31');
  });

  it('gets February right in a leap year', () => {
    expect(periodRange(goal({ period: 'month' }), '2024-02-10').end).toBe('2024-02-29');
  });

  it('gets the first quarter right', () => {
    expect(periodRange(goal({ period: 'quarter' }), '2026-01-05')).toEqual({
      start: '2026-01-01',
      end: '2026-03-31'
    });
  });
});

describe('measure — goals count themselves', () => {
  const entries = {
    '2026-07-15': day({ closings: 1 }),
    '2026-08-02': day({ closings: 2, leases: 2 }),
    '2026-08-20': day({ listings: 3, calls: 10 }),
    '2026-12-01': day({ closings: 5 })
  };

  it('sums a production metric across the period', () => {
    const g = goal({ metric: 'closings', period: 'year' });
    expect(measure(g, entries, periodRange(g, '2026-08-14'))).toBe(8);
  });

  it('counts a lease as half a side', () => {
    const g = goal({ metric: 'sides', period: 'month' });
    expect(measure(g, entries, periodRange(g, '2026-08-14'))).toBe(3);
  });

  it('sums an activity metric', () => {
    const g = goal({ metric: 'calls', period: 'month' });
    expect(measure(g, entries, periodRange(g, '2026-08-14'))).toBe(10);
  });

  it('respects the period boundary', () => {
    const g = goal({ metric: 'closings', period: 'month' });
    // July's closing and December's are both outside August.
    expect(measure(g, entries, periodRange(g, '2026-08-14'))).toBe(2);
  });

  it('uses the typed number for a manual goal and ignores the logs', () => {
    const g = goal({ metric: 'manual', manualCurrent: 12, period: 'year' });
    expect(measure(g, entries, periodRange(g, '2026-08-14'))).toBe(12);
  });

  it('returns zero rather than failing on an empty log', () => {
    const g = goal({ metric: 'closings' });
    expect(measure(g, {}, periodRange(g, '2026-08-14'))).toBe(0);
    expect(measure(g, null, periodRange(g, '2026-08-14'))).toBe(0);
  });
});

describe('tabulate — pace is the number that matters at a session', () => {
  const entries = { '2026-01-15': day({ closings: 6 }) };

  it('reports ahead of pace', () => {
    // Half way through the year, 6 of 8 done.
    const t = tabulate(goal({ metric: 'closings', target: 8, period: 'year' }), entries, '2026-07-02');
    expect(t.current).toBe(6);
    expect(t.onTrack).toBe(true);
    expect(t.delta).toBeGreaterThan(0);
  });

  it('reports behind pace', () => {
    const t = tabulate(goal({ metric: 'closings', target: 24, period: 'year' }), entries, '2026-07-02');
    expect(t.onTrack).toBe(false);
    expect(t.delta).toBeLessThan(0);
  });

  it('does not call a goal behind on the first day of its period', () => {
    const t = tabulate(goal({ metric: 'closings', target: 24, period: 'year' }), {}, '2026-01-01');
    expect(t.expected).toBeCloseTo(24 / 365, 1);
    expect(t.delta).toBeLessThanOrEqual(0);
    expect(t.percent).toBe(0);
  });

  it('judges a finished period on the result, not on pace', () => {
    const hit = tabulate(
      goal({ metric: 'closings', target: 5, period: 'custom', start: '2026-01-01', end: '2026-06-30' }),
      entries,
      '2026-08-14'
    );
    expect(hit.finished).toBe(true);
    expect(hit.onTrack).toBe(true);
  });

  it('marks a finished period as missed when it was', () => {
    const missed = tabulate(
      goal({ metric: 'closings', target: 20, period: 'custom', start: '2026-01-01', end: '2026-06-30' }),
      entries,
      '2026-08-14'
    );
    expect(missed.finished).toBe(true);
    expect(missed.onTrack).toBe(false);
  });

  it('counts down the days left', () => {
    const t = tabulate(goal({ period: 'month', target: 1 }), {}, '2026-08-30');
    expect(t.daysLeft).toBe(1);
  });

  it('has no pace opinion without a target', () => {
    const t = tabulate(goal({ metric: 'calls', target: 0 }), {}, '2026-08-14');
    expect(t.onTrack).toBeNull();
    expect(t.percent).toBeNull();
  });

  it('flags whether the number counts itself', () => {
    expect(tabulate(goal({ metric: 'sides' }), {}, '2026-08-14').tracked).toBe(true);
    expect(tabulate(goal({ metric: 'manual' }), {}, '2026-08-14').tracked).toBe(false);
  });
});

describe('groupByPeriod', () => {
  const goals = [
    goal({ label: 'Sides', metric: 'sides', target: 24, period: 'year' }),
    goal({ label: 'Listings', metric: 'listings', target: 2, period: 'month' }),
    goal({ label: 'Calls', metric: 'calls', target: 300, period: 'quarter' })
  ];

  it('orders groups shortest horizon first', () => {
    expect(groupByPeriod(goals, {}, '2026-08-14').map((g) => g.key)).toEqual([
      'month',
      'quarter',
      'year'
    ]);
  });

  it('omits periods with no goals', () => {
    expect(groupByPeriod([goals[0]], {}, '2026-08-14').map((g) => g.key)).toEqual(['year']);
  });

  it('returns nothing when there are no goals', () => {
    expect(groupByPeriod([], {}, '2026-08-14')).toEqual([]);
  });
});

describe('goalsNarrative — what goes on the broker form', () => {
  const entries = { '2026-01-15': day({ closings: 6, leases: 2 }) };

  it('groups by period and states pace in words', () => {
    const text = goalsNarrative(
      [
        migrateGoal({ label: 'Sides', metric: 'sides', target: 24, period: 'year' }),
        migrateGoal({ label: 'Listings', metric: 'listings', target: 2, period: 'month' })
      ],
      entries,
      '2026-07-02'
    );
    expect(text).toMatch(/This month/);
    expect(text).toMatch(/This year/);
    expect(text).toMatch(/Sides: 7 of 24 — .* behind pace/);
  });

  it('says when something is ahead', () => {
    const text = goalsNarrative(
      [migrateGoal({ label: 'Sides', metric: 'sides', target: 8, period: 'year' })],
      entries,
      '2026-07-02'
    );
    expect(text).toMatch(/ahead of pace/);
  });

  it('is empty with no goals', () => {
    expect(goalsNarrative([], entries, '2026-07-02')).toBe('');
  });

  it('omits pace for a goal with no target', () => {
    const text = goalsNarrative(
      [migrateGoal({ label: 'Calls', metric: 'calls', target: 0, period: 'month' })],
      entries,
      '2026-07-02'
    );
    expect(text).not.toMatch(/pace/);
  });
});

describe('the coaching cycle period', () => {
  const cycle = { start: '2026-08-01', end: '2026-08-14' };
  const entries = {
    '2026-07-28': day({ closings: 5 }), // before the cycle
    '2026-08-05': day({ closings: 1 }),
    '2026-08-11': day({ closings: 2 })
  };

  it('measures only the days between sessions', () => {
    const g = goal({ metric: 'closings', target: 4, period: 'cycle' });
    expect(tabulate(g, entries, '2026-08-14', cycle).current).toBe(3);
  });

  it('moves with a session that slips rather than mis-reporting', () => {
    const g = goal({ metric: 'closings', target: 4, period: 'cycle' });
    const slipped = { start: '2026-07-25', end: '2026-08-14' };
    expect(tabulate(g, entries, '2026-08-14', slipped).current).toBe(8);
  });

  it('falls back to a fortnight when no cycle is known', () => {
    const range = periodRange(goal({ period: 'cycle' }), '2026-08-14');
    expect(range).toEqual({ start: '2026-08-01', end: '2026-08-14' });
  });

  it('sorts ahead of the calendar periods', () => {
    const goals = [
      goal({ label: 'Y', metric: 'closings', target: 1, period: 'year' }),
      goal({ label: 'C', metric: 'closings', target: 1, period: 'cycle' }),
      goal({ label: 'M', metric: 'closings', target: 1, period: 'month' })
    ];
    expect(groupByPeriod(goals, entries, '2026-08-14', cycle).map((g) => g.key)).toEqual([
      'cycle',
      'month',
      'year'
    ]);
  });

  it('reaches the form narrative under its own heading', () => {
    const g = migrateGoal({ label: 'Closings', metric: 'closings', target: 4, period: 'cycle' });
    expect(goalsNarrative([g], entries, '2026-08-14', cycle)).toMatch(/This coaching cycle/);
  });
});

describe('pace reads honestly, without false precision', () => {
  const entries = { '2026-01-15': day({ closings: 6 }) };

  it('says "on pace" rather than inventing a tenth of a unit', () => {
    // Contrived so the delta lands under 1 either way.
    const t = tabulate(goal({ metric: 'closings', target: 12, period: 'year' }), entries, '2026-07-02');
    expect(Math.abs(t.delta)).toBeLessThan(1);
    expect(t.onPace).toBe(true);
    expect(paceLabel(t)).toBe('on pace');
  });

  it('rounds a pace gap to whole units', () => {
    const t = tabulate(goal({ metric: 'closings', target: 24, period: 'year' }), entries, '2026-07-02');
    expect(Number.isInteger(t.deltaWhole)).toBe(true);
    expect(paceLabel(t)).toMatch(/^\d+ behind pace$/);
  });

  it('never puts a decimal in the words', () => {
    const text = goalsNarrative(
      [migrateGoal({ label: 'Calls', metric: 'calls', target: 500, period: 'quarter' })],
      { '2026-08-05': day({ calls: 210 }) },
      '2026-08-14'
    );
    expect(text).not.toMatch(/\d\.\d/);
  });

  it('reports a finished period as hit or missed, not as pace', () => {
    const done = tabulate(
      goal({ metric: 'closings', target: 5, period: 'custom', start: '2026-01-01', end: '2026-06-30' }),
      entries,
      '2026-08-14'
    );
    expect(paceLabel(done)).toBe('hit');
  });

  it('has nothing to say about a goal with no target', () => {
    expect(paceLabel(tabulate(goal({ metric: 'calls', target: 0 }), entries, '2026-08-14'))).toBe('');
  });
});

describe('blankGoal', () => {
  it('gives each goal its own id', () => {
    expect(blankGoal().id).not.toBe(blankGoal().id);
  });
});
