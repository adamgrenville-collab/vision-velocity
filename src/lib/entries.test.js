import { describe, it, expect } from 'vitest';
import {
  blankEntry,
  migrateEntry,
  migrateAll,
  summarize,
  recentKeys,
  ACTIVITY_KEYS,
  PRODUCTION_KEYS,
  ACTION_PLAN_SLOTS
} from './entries.js';

describe('blankEntry', () => {
  it('has every activity and production counter at zero', () => {
    const e = blankEntry();
    for (const key of ACTIVITY_KEYS) expect(e.activities[key]).toBe(0);
    for (const key of PRODUCTION_KEYS) expect(e.production[key]).toBe(0);
  });

  it('returns a fresh object each call, not a shared reference', () => {
    const a = blankEntry();
    const b = blankEntry();
    a.activities.calls = 99;
    a.actionPlan[0].text = 'mutated';
    expect(b.activities.calls).toBe(0);
    expect(b.actionPlan[0].text).toBe('');
  });
});

describe('migrateEntry — never throws', () => {
  const garbage = [
    undefined, null, 0, 1, '', 'a string', true, false, [], [1, 2, 3], NaN,
    { mindset: null }, { activities: 'nope' }, { production: [] },
    { actionPlan: 'not-an-array' }, { actionPlan: null }, { pipeline: 42 }
  ];

  for (const input of garbage) {
    it(`survives ${JSON.stringify(input) ?? String(input)}`, () => {
      const e = migrateEntry(input);
      expect(e.actionPlan).toHaveLength(ACTION_PLAN_SLOTS);
      expect(typeof e.mindset.feeling).toBe('string');
      expect(typeof e.pipeline).toBe('string');
      for (const key of ACTIVITY_KEYS) expect(typeof e.activities[key]).toBe('number');
    });
  }
});

describe('migrateEntry — legacy field renames', () => {
  it('adopts social -> reSocial and coffee -> meetUps', () => {
    const e = migrateEntry({ activities: { social: 5, coffee: 2 } });
    expect(e.activities.reSocial).toBe(5);
    expect(e.activities.meetUps).toBe(2);
  });

  it('prefers the current field when both are present', () => {
    const e = migrateEntry({ activities: { social: 5, reSocial: 9 } });
    expect(e.activities.reSocial).toBe(9);
  });

  it('does not adopt a legacy value over an explicit zero', () => {
    const e = migrateEntry({ activities: { social: 5, reSocial: 0 } });
    expect(e.activities.reSocial).toBe(0);
  });
});

describe('migrateEntry — action plan', () => {
  it('pads a short plan up to five slots', () => {
    const e = migrateEntry({ actionPlan: [{ text: 'one', done: true }] });
    expect(e.actionPlan).toHaveLength(ACTION_PLAN_SLOTS);
    expect(e.actionPlan[0]).toEqual({ text: 'one', done: true });
    expect(e.actionPlan[4]).toEqual({ text: '', done: false });
  });

  it('truncates a plan longer than five slots', () => {
    const long = Array.from({ length: 9 }, (_, i) => ({ text: `t${i}`, done: false }));
    expect(migrateEntry({ actionPlan: long }).actionPlan).toHaveLength(ACTION_PLAN_SLOTS);
  });

  it('replaces junk items with empty slots but keeps good neighbours', () => {
    const e = migrateEntry({ actionPlan: [{ text: 'keep' }, null, 42, { text: 'also' }] });
    expect(e.actionPlan[0].text).toBe('keep');
    expect(e.actionPlan[1]).toEqual({ text: '', done: false });
    expect(e.actionPlan[2]).toEqual({ text: '', done: false });
    expect(e.actionPlan[3].text).toBe('also');
  });

  it('coerces a truthy non-boolean done into a real boolean', () => {
    const e = migrateEntry({ actionPlan: [{ text: 'x', done: 'yes' }] });
    expect(e.actionPlan[0].done).toBe(false);
  });
});

describe('migrateEntry — counter coercion', () => {
  it('floors and clamps nonsense counts to zero', () => {
    const e = migrateEntry({ activities: { calls: -5, texts: 'abc', notes: 3.7, videos: null } });
    expect(e.activities.calls).toBe(0);
    expect(e.activities.texts).toBe(0);
    expect(e.activities.notes).toBe(3);
    expect(e.activities.videos).toBe(0);
  });

  it('keeps a numeric string that is a real number', () => {
    expect(migrateEntry({ activities: { calls: '7' } }).activities.calls).toBe(7);
  });
});

describe('migrateEntry — mindset', () => {
  it('coerces non-string mindset fields to empty strings', () => {
    const e = migrateEntry({ mindset: { feeling: 42, win: null, belief: {} } });
    expect(e.mindset.feeling).toBe('');
    expect(e.mindset.win).toBe('');
    expect(e.mindset.belief).toBe('');
  });

  it('preserves real values', () => {
    const e = migrateEntry({ mindset: { feeling: 'focused', roadblock: 'no leads' } });
    expect(e.mindset.feeling).toBe('focused');
    expect(e.mindset.roadblock).toBe('no leads');
  });
});

describe('migrateAll', () => {
  it('drops keys that are not date-shaped', () => {
    const out = migrateAll({ '2026-08-01': {}, 'velocity_api_key': 'leaked', 'junk': {} });
    expect(Object.keys(out)).toEqual(['2026-08-01']);
  });

  it('returns an empty map for garbage input', () => {
    expect(migrateAll(null)).toEqual({});
    expect(migrateAll('nope')).toEqual({});
    expect(migrateAll([1, 2])).toEqual({});
  });
});

describe('summarize', () => {
  const entries = {
    '2026-08-01': migrateEntry({
      activities: { calls: 3, texts: 2, clientCheckIns: 1 },
      production: { pendings: 1 },
      mindset: { roadblock: 'no leads', peakTime: 'Morning' }
    }),
    '2026-07-31': migrateEntry({
      activities: { calls: 4, texts: 1 },
      mindset: { peakTime: 'Morning' }
    })
  };

  it('adds conversations across days', () => {
    expect(summarize(entries, ['2026-08-01', '2026-07-31']).conversations).toBe(10);
  });

  it('ignores dates with no entry', () => {
    expect(summarize(entries, ['2026-08-01', '2020-01-01']).conversations).toBe(5);
  });

  it('collects roadblocks with their dates', () => {
    const s = summarize(entries, ['2026-08-01', '2026-07-31']);
    expect(s.roadblocks).toEqual([{ date: '2026-08-01', roadblock: 'no leads' }]);
  });

  it('tallies peak times', () => {
    expect(summarize(entries, ['2026-08-01', '2026-07-31']).peakTimes.Morning).toBe(2);
  });

  it('returns zeros for an empty range', () => {
    const s = summarize({}, []);
    expect(s.conversations).toBe(0);
    expect(s.roadblocks).toEqual([]);
  });
});

describe('recentKeys', () => {
  it('returns newest first', () => {
    const map = { '2026-07-30': {}, '2026-08-01': {}, '2026-07-31': {} };
    expect(recentKeys(map)).toEqual(['2026-08-01', '2026-07-31', '2026-07-30']);
  });

  it('caps at the requested count', () => {
    const map = {};
    for (let d = 1; d <= 20; d++) map[`2026-08-${String(d).padStart(2, '0')}`] = {};
    expect(recentKeys(map, 7)).toHaveLength(7);
    expect(recentKeys(map, 7)[0]).toBe('2026-08-20');
  });
});
