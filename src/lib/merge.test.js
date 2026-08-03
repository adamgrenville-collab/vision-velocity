import { describe, it, expect } from 'vitest';
import { mergeEntries, mergeSessions, mergeProfile, mergeAll, differs } from './merge.js';

const day = (calls, updatedAt) => ({ activities: { calls }, updatedAt });

describe('mergeEntries — nobody loses a day', () => {
  it('keeps days that exist on only one device', () => {
    const local = { '2026-08-01': day(3, 100) };
    const remote = { '2026-08-02': day(5, 100) };
    const out = mergeEntries(local, remote);
    expect(Object.keys(out).sort()).toEqual(['2026-08-01', '2026-08-02']);
  });

  it('takes the newer edit for a day both devices touched', () => {
    const local = { '2026-08-01': day(3, 100) };
    const remote = { '2026-08-01': day(9, 200) };
    expect(mergeEntries(local, remote)['2026-08-01'].activities.calls).toBe(9);
  });

  it('keeps the local edit when local is newer', () => {
    const local = { '2026-08-01': day(9, 300) };
    const remote = { '2026-08-01': day(3, 200) };
    expect(mergeEntries(local, remote)['2026-08-01'].activities.calls).toBe(9);
  });

  it('does not let a stale device clobber other days', () => {
    // The laptop has an old copy of Aug 1 and has never seen Aug 2.
    const laptop = { '2026-08-01': day(1, 100) };
    const phone = { '2026-08-01': day(4, 500), '2026-08-02': day(7, 500) };
    const out = mergeEntries(laptop, phone);
    expect(out['2026-08-01'].activities.calls).toBe(4);
    expect(out['2026-08-02'].activities.calls).toBe(7);
  });

  it('treats data with no timestamp as older than any real edit', () => {
    const legacy = { '2026-08-01': { activities: { calls: 99 } } };
    const synced = { '2026-08-01': day(2, 1) };
    expect(mergeEntries(legacy, synced)['2026-08-01'].activities.calls).toBe(2);
  });

  it('still keeps untimestamped data when the other side has none', () => {
    const legacy = { '2026-08-01': { activities: { calls: 99 } } };
    expect(mergeEntries(legacy, {})['2026-08-01'].activities.calls).toBe(99);
  });

  it('ignores a corrupt timestamp rather than trusting it', () => {
    const local = { '2026-08-01': day(5, 100) };
    const remote = { '2026-08-01': day(1, 'tomorrow') };
    expect(mergeEntries(local, remote)['2026-08-01'].activities.calls).toBe(5);
  });

  it('handles missing sides', () => {
    expect(mergeEntries(null, null)).toEqual({});
    expect(Object.keys(mergeEntries({ a: day(1, 1) }, undefined))).toEqual(['a']);
  });
});

describe('mergeEntries — order and repetition do not matter', () => {
  const a = { '2026-08-01': day(3, 100), '2026-08-03': day(1, 400) };
  const b = { '2026-08-01': day(9, 200), '2026-08-02': day(5, 150) };

  it('is commutative', () => {
    expect(mergeEntries(a, b)).toEqual(mergeEntries(b, a));
  });

  it('is idempotent', () => {
    const once = mergeEntries(a, b);
    expect(mergeEntries(once, b)).toEqual(once);
    expect(mergeEntries(once, once)).toEqual(once);
  });
});

describe('mergeSessions', () => {
  const s = (id, date, note, updatedAt) => ({ id, date, notes: note, updatedAt });

  it('unions by id', () => {
    const out = mergeSessions([s('a', '2026-08-01', 'x', 1)], [s('b', '2026-08-15', 'y', 1)]);
    expect(out.map((x) => x.id)).toEqual(['a', 'b']);
  });

  it('takes the newer version of the same session', () => {
    const out = mergeSessions([s('a', '2026-08-01', 'old', 100)], [s('a', '2026-08-01', 'new', 200)]);
    expect(out).toHaveLength(1);
    expect(out[0].notes).toBe('new');
  });

  it('returns sessions in date order', () => {
    const out = mergeSessions(
      [s('c', '2026-09-01', '', 1), s('a', '2026-07-01', '', 1)],
      [s('b', '2026-08-01', '', 1)]
    );
    expect(out.map((x) => x.date)).toEqual(['2026-07-01', '2026-08-01', '2026-09-01']);
  });

  it('drops entries with no id rather than duplicating them', () => {
    expect(mergeSessions([{ date: '2026-08-01' }], [])).toEqual([]);
  });

  it('is commutative and idempotent', () => {
    const a = [s('x', '2026-08-01', 'a', 100)];
    const b = [s('x', '2026-08-01', 'b', 200), s('y', '2026-08-05', 'c', 100)];
    expect(mergeSessions(a, b)).toEqual(mergeSessions(b, a));
    expect(mergeSessions(mergeSessions(a, b), b)).toEqual(mergeSessions(a, b));
  });

  it('handles missing sides', () => {
    expect(mergeSessions(null, null)).toEqual([]);
  });
});

describe('mergeProfile', () => {
  it('takes the newer profile wholesale', () => {
    const local = { name: 'Adam', goals: [1], updatedAt: 100 };
    const remote = { name: 'Adam G', goals: [1, 2], updatedAt: 200 };
    expect(mergeProfile(local, remote).name).toBe('Adam G');
  });

  it('never returns undefined', () => {
    expect(mergeProfile(null, null)).toEqual({});
  });
});

describe('mergeAll', () => {
  it('merges every section independently', () => {
    const local = {
      entries: { '2026-08-01': day(3, 100) },
      sessions: [{ id: 'a', date: '2026-08-01', updatedAt: 100 }],
      profile: { name: 'Local', updatedAt: 100 }
    };
    const remote = {
      entries: { '2026-08-02': day(5, 200) },
      sessions: [{ id: 'b', date: '2026-08-15', updatedAt: 200 }],
      profile: { name: 'Remote', updatedAt: 200 }
    };
    const out = mergeAll(local, remote);
    expect(Object.keys(out.entries)).toHaveLength(2);
    expect(out.sessions).toHaveLength(2);
    expect(out.profile.name).toBe('Remote');
  });

  it('survives an empty remote, which is the first-ever sync', () => {
    const local = { entries: { '2026-08-01': day(3, 100) }, sessions: [], profile: {} };
    expect(mergeAll(local, {}).entries['2026-08-01'].activities.calls).toBe(3);
  });

  it('survives an empty local, which is signing in on a new device', () => {
    const remote = { entries: { '2026-08-01': day(3, 100) }, sessions: [], profile: {} };
    expect(mergeAll({}, remote).entries['2026-08-01'].activities.calls).toBe(3);
  });

  it('survives both sides being garbage', () => {
    const out = mergeAll(null, undefined);
    expect(out.entries).toEqual({});
    expect(out.sessions).toEqual([]);
  });
});

describe('differs', () => {
  it('spots a change', () => {
    expect(differs({ a: 1 }, { a: 2 })).toBe(true);
  });

  it('sees identical data as unchanged, so we do not upload needlessly', () => {
    expect(differs({ a: 1 }, { a: 1 })).toBe(false);
  });
});
