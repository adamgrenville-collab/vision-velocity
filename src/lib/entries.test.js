import { describe, it, expect } from 'vitest';
import {
  blankEntry,
  migrateEntry,
  migrateAll,
  summarize,
  recentKeys,
  keysInWindow,
  isBlank,
  ACTIVITY_KEYS,
  PRODUCTION_KEYS,
  ACTION_PLAN_SLOTS
} from './entries.js';

describe('the model matches the coaching form', () => {
  it('tracks exactly the activities the form lists', () => {
    expect(ACTIVITY_KEYS).toEqual([
      'notes',
      'calls',
      'texts',
      'videos',
      'socialPosts',
      'popBys',
      'clientParties',
      'coffee'
    ]);
  });

  it('tracks exactly the production the form lists', () => {
    expect(PRODUCTION_KEYS).toEqual(['listings', 'pendings', 'closings']);
  });

  it('commits to three actions, as the form does', () => {
    expect(ACTION_PLAN_SLOTS).toBe(3);
    expect(blankEntry().actionPlan).toHaveLength(3);
  });
});

describe('blankEntry', () => {
  it('has every counter at zero', () => {
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
    { actionPlan: 'not-an-array' }, { actionPlan: null }, { notes: 42 }
  ];

  for (const input of garbage) {
    it(`survives ${JSON.stringify(input) ?? String(input)}`, () => {
      const e = migrateEntry(input);
      expect(e.actionPlan).toHaveLength(ACTION_PLAN_SLOTS);
      expect(typeof e.mindset.feeling).toBe('string');
      expect(typeof e.notes).toBe('string');
      for (const key of ACTIVITY_KEYS) expect(typeof e.activities[key]).toBe('number');
    });
  }
});

describe('migrateEntry — legacy renames', () => {
  it('carries the original social field forward two renames', () => {
    expect(migrateEntry({ activities: { social: 5 } }).activities.socialPosts).toBe(5);
  });

  it('carries reSocial forward to socialPosts', () => {
    expect(migrateEntry({ activities: { reSocial: 4 } }).activities.socialPosts).toBe(4);
  });

  it('carries meetUps forward to coffee', () => {
    expect(migrateEntry({ activities: { meetUps: 2 } }).activities.coffee).toBe(2);
  });

  it('prefers the current field when both exist', () => {
    expect(migrateEntry({ activities: { reSocial: 5, socialPosts: 9 } }).activities.socialPosts).toBe(9);
  });

  it('drops clientCheckIns, which was never on the form', () => {
    const e = migrateEntry({ activities: { clientCheckIns: 7 } });
    expect(e.activities.clientCheckIns).toBeUndefined();
    expect(Object.keys(e.activities)).toEqual(ACTIVITY_KEYS);
  });

  it('carries the old pipeline field into notes', () => {
    expect(migrateEntry({ pipeline: 'Henderson deal' }).notes).toBe('Henderson deal');
  });
});

describe('migrateEntry — action plan', () => {
  it('pads a short plan to three slots', () => {
    const e = migrateEntry({ actionPlan: [{ text: 'one', done: true }] });
    expect(e.actionPlan).toHaveLength(3);
    expect(e.actionPlan[0]).toEqual({ text: 'one', done: true });
    expect(e.actionPlan[2]).toEqual({ text: '', done: false });
  });

  it('truncates a five-slot plan from the old version to three', () => {
    const old = Array.from({ length: 5 }, (_, i) => ({ text: `t${i}`, done: false }));
    const e = migrateEntry({ actionPlan: old });
    expect(e.actionPlan).toHaveLength(3);
    expect(e.actionPlan[2].text).toBe('t2');
  });

  it('replaces junk items but keeps good neighbours', () => {
    const e = migrateEntry({ actionPlan: [{ text: 'keep' }, null, { text: 'also' }] });
    expect(e.actionPlan[0].text).toBe('keep');
    expect(e.actionPlan[1]).toEqual({ text: '', done: false });
    expect(e.actionPlan[2].text).toBe('also');
  });

  it('coerces a truthy non-boolean done into a real boolean', () => {
    expect(migrateEntry({ actionPlan: [{ text: 'x', done: 'yes' }] }).actionPlan[0].done).toBe(false);
  });
});

describe('migrateEntry — counter coercion', () => {
  it('floors and clamps nonsense to zero', () => {
    const e = migrateEntry({ activities: { calls: -5, texts: 'abc', notes: 3.7, videos: null } });
    expect(e.activities.calls).toBe(0);
    expect(e.activities.texts).toBe(0);
    expect(e.activities.notes).toBe(3);
    expect(e.activities.videos).toBe(0);
  });

  it('accepts a numeric string', () => {
    expect(migrateEntry({ activities: { calls: '7' } }).activities.calls).toBe(7);
  });
});

describe('migrateAll', () => {
  it('drops keys that are not date-shaped', () => {
    const out = migrateAll({ '2026-08-01': {}, velocity_api_key: 'leaked', junk: {} });
    expect(Object.keys(out)).toEqual(['2026-08-01']);
  });

  it('returns an empty map for garbage', () => {
    expect(migrateAll(null)).toEqual({});
    expect(migrateAll('nope')).toEqual({});
    expect(migrateAll([1, 2])).toEqual({});
  });
});

describe('isBlank', () => {
  it('treats a fresh entry as blank', () => {
    expect(isBlank(blankEntry())).toBe(true);
    expect(isBlank(undefined)).toBe(true);
  });

  it('notices any single logged thing', () => {
    const withCall = blankEntry();
    withCall.activities.calls = 1;
    expect(isBlank(withCall)).toBe(false);

    const withFeeling = blankEntry();
    withFeeling.mindset.feeling = 'good';
    expect(isBlank(withFeeling)).toBe(false);

    const withPlan = blankEntry();
    withPlan.actionPlan[0].text = 'call someone';
    expect(isBlank(withPlan)).toBe(false);

    const withListing = blankEntry();
    withListing.production.listings = 1;
    expect(isBlank(withListing)).toBe(false);
  });
});

describe('summarize', () => {
  const make = (over) => migrateEntry(over);
  const entries = {
    '2026-08-01': make({
      activities: { calls: 3, texts: 2, popBys: 1 },
      production: { pendings: 1 },
      mindset: { roadblock: 'no leads' },
      actionPlan: [{ text: 'a', done: true }, { text: 'b', done: false }, { text: '', done: false }]
    }),
    '2026-07-31': make({
      activities: { calls: 4, texts: 1 },
      actionPlan: [{ text: 'c', done: true }, { text: '', done: false }, { text: '', done: false }]
    }),
    '2026-07-30': blankEntry()
  };
  const keys = ['2026-08-01', '2026-07-31', '2026-07-30'];

  it('adds conversations across days', () => {
    expect(summarize(entries, keys).conversations).toBe(10);
  });

  it('counts only days that were actually logged', () => {
    expect(summarize(entries, keys).daysLogged).toBe(2);
  });

  it('tracks commitment follow-through', () => {
    const s = summarize(entries, keys);
    expect(s.targetsSet).toBe(3);
    expect(s.targetsDone).toBe(2);
  });

  it('ignores an empty target when counting commitments', () => {
    expect(summarize({ x: make({ actionPlan: [{ text: '', done: true }] }) }, ['x']).targetsSet).toBe(0);
  });

  it('totals all activity types, not just conversations', () => {
    expect(summarize(entries, keys).totalActivity).toBe(11);
  });

  it('collects roadblocks with their dates', () => {
    expect(summarize(entries, keys).roadblocks).toEqual([
      { date: '2026-08-01', roadblock: 'no leads' }
    ]);
  });

  it('returns zeros for an empty range', () => {
    const s = summarize({}, []);
    expect(s.conversations).toBe(0);
    expect(s.daysLogged).toBe(0);
    expect(s.roadblocks).toEqual([]);
  });
});

describe('keysInWindow', () => {
  it('returns the requested number of days, oldest first', () => {
    expect(keysInWindow('2026-08-03', 3)).toEqual(['2026-08-01', '2026-08-02', '2026-08-03']);
  });

  it('crosses a month boundary', () => {
    expect(keysInWindow('2026-08-01', 2)).toEqual(['2026-07-31', '2026-08-01']);
  });

  it('crosses a year boundary', () => {
    expect(keysInWindow('2027-01-01', 2)).toEqual(['2026-12-31', '2027-01-01']);
  });

  it('handles a full two-week coaching cycle', () => {
    const window = keysInWindow('2026-08-14', 14);
    expect(window).toHaveLength(14);
    expect(window[0]).toBe('2026-08-01');
    expect(window[13]).toBe('2026-08-14');
  });
});

describe('recentKeys', () => {
  it('returns newest first', () => {
    const map = { '2026-07-30': {}, '2026-08-01': {}, '2026-07-31': {} };
    expect(recentKeys(map)).toEqual(['2026-08-01', '2026-07-31', '2026-07-30']);
  });

  it('caps at the requested count', () => {
    const map = {};
    for (let d = 1; d <= 20; d += 1) map[`2026-08-${String(d).padStart(2, '0')}`] = {};
    expect(recentKeys(map, 7)).toHaveLength(7);
    expect(recentKeys(map, 7)[0]).toBe('2026-08-20');
  });
});
