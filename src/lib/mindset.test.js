import { describe, it, expect } from 'vitest';
import { mindsetSummary, mindsetNarrative, themes } from './mindset.js';
import { migrateEntry } from './entries.js';

const day = ({ calls = 0, feeling = '', win = '', roadblock = '', dayOff = false } = {}) =>
  migrateEntry({ activities: { calls }, mindset: { feeling, win, roadblock }, dayOff });

describe('themes', () => {
  it('finds a word repeated across separate days', () => {
    const out = themes(['no leads coming in', 'leads dried up', 'chasing leads all day']);
    expect(out[0].word).toBe('leads');
    expect(out[0].days).toBe(3);
  });

  it('ignores a word that only appears once', () => {
    expect(themes(['inspection ran long', 'no leads'])).toEqual([]);
  });

  it('counts a word repeated within one day only once', () => {
    expect(themes(['leads leads leads', 'leads again'])[0].days).toBe(2);
  });

  it('drops filler words', () => {
    expect(themes(['that was really just a day', 'that was really just a day'])).toEqual([]);
  });

  it('ignores very short words', () => {
    expect(themes(['fog fog', 'fog fog'])).toEqual([]);
  });

  it('handles empty and malformed input', () => {
    expect(themes([])).toEqual([]);
    expect(themes([null, undefined, '', 42])).toEqual([]);
  });
});

describe('mindsetSummary — collects what would otherwise be lost', () => {
  const entries = {
    '2026-08-01': day({ calls: 20, feeling: 'sharp', win: 'Took Oak St' }),
    '2026-08-02': day({ calls: 4, feeling: 'drained', roadblock: 'no leads today' }),
    '2026-08-03': day({ calls: 18, feeling: 'steady', win: 'Two appointments' }),
    '2026-08-04': day({ calls: 3, roadblock: 'no leads again' }),
    '2026-08-05': day({ calls: 22, feeling: 'good' })
  };
  const keys = Object.keys(entries);

  it('gathers every check-in with its date', () => {
    const s = mindsetSummary(entries, keys);
    expect(s.feelings).toHaveLength(4);
    expect(s.wins).toHaveLength(2);
    expect(s.roadblocks).toHaveLength(2);
    expect(s.feelings[0]).toEqual({ date: '2026-08-01', text: 'sharp' });
  });

  it('counts days with any check-in at all', () => {
    expect(mindsetSummary(entries, keys).checkedIn).toBe(5);
  });

  it('surfaces a recurring roadblock theme', () => {
    expect(mindsetSummary(entries, keys).roadblockThemes[0].word).toBe('leads');
  });

  it('identifies the best and hardest working days', () => {
    const s = mindsetSummary(entries, keys);
    expect(s.bestDay.date).toBe('2026-08-05');
    expect(s.hardestDay.date).toBe('2026-08-04');
  });

  it('ignores dates with no entry', () => {
    expect(mindsetSummary(entries, [...keys, '2020-01-01']).days).toHaveLength(5);
  });

  it('survives missing and malformed input', () => {
    expect(mindsetSummary(null, ['2026-08-01']).checkedIn).toBe(0);
    expect(mindsetSummary({}, []).feelings).toEqual([]);
    expect(mindsetSummary({ x: {} }, ['x']).checkedIn).toBe(0);
  });
});

describe('mindsetSummary — the roadblock/output correlation', () => {
  const build = (spec) => {
    const entries = {};
    spec.forEach((s, i) => {
      entries[`2026-08-${String(i + 1).padStart(2, '0')}`] = day(s);
    });
    return mindsetSummary(entries, Object.keys(entries));
  };

  it('reports the drop when there is enough on both sides', () => {
    const s = build([
      { calls: 20 }, { calls: 20 },
      { calls: 10, roadblock: 'stuck' }, { calls: 10, roadblock: 'stuck' }
    ]);
    expect(s.effect.changePercent).toBe(-50);
    expect(s.effect.blockedDays).toBe(2);
    expect(s.effect.clearDays).toBe(2);
  });

  it('refuses to report from a single blocked day', () => {
    // One anecdote wearing a percentage sign is worse than no number at all.
    const s = build([{ calls: 20 }, { calls: 20 }, { calls: 2, roadblock: 'stuck' }]);
    expect(s.effect).toBeNull();
  });

  it('refuses to report from a single clear day', () => {
    const s = build([{ calls: 20 }, { calls: 2, roadblock: 'a' }, { calls: 3, roadblock: 'b' }]);
    expect(s.effect).toBeNull();
  });

  it('reports honestly when blocked days were not actually worse', () => {
    const s = build([
      { calls: 10 }, { calls: 10 },
      { calls: 15, roadblock: 'stuck' }, { calls: 15, roadblock: 'stuck' }
    ]);
    expect(s.effect.changePercent).toBe(50);
  });

  it('excludes planned days off from the comparison', () => {
    const s = build([
      { calls: 20 }, { calls: 20 }, { calls: 0, dayOff: true },
      { calls: 10, roadblock: 'x' }, { calls: 10, roadblock: 'y' }
    ]);
    expect(s.effect.clearDays).toBe(2);
    expect(s.effect.clearMean).toBe(20);
  });

  it('does not divide by zero when clear days produced nothing', () => {
    const s = build([
      { calls: 0 }, { calls: 0 },
      { calls: 5, roadblock: 'x' }, { calls: 5, roadblock: 'y' }
    ]);
    expect(Number.isFinite(s.effect.changePercent)).toBe(true);
  });
});

describe('mindsetNarrative', () => {
  const from = (entries) => mindsetNarrative(mindsetSummary(entries, Object.keys(entries)));

  it('is empty when nothing was checked in', () => {
    expect(from({ a: day({ calls: 5 }) })).toBe('');
  });

  it('summarises days, roadblocks and wins', () => {
    const text = from({
      a: day({ calls: 20, feeling: 'good', win: 'Listing' }),
      b: day({ calls: 4, roadblock: 'no leads' })
    });
    expect(text).toMatch(/Checked in on 2 days/);
    expect(text).toMatch(/slowed me down on 1/);
    expect(text).toMatch(/1 win/);
  });

  it('states the drop in plain language when there is one', () => {
    const text = from({
      a: day({ calls: 20 }), b: day({ calls: 20, feeling: 'ok' }),
      c: day({ calls: 10, roadblock: 'stuck' }), d: day({ calls: 10, roadblock: 'stuck' })
    });
    expect(text).toMatch(/50% lower on the 2 blocked days/);
  });

  it('does not claim a drop when activity held up', () => {
    const text = from({
      a: day({ calls: 10 }), b: day({ calls: 10, feeling: 'ok' }),
      c: day({ calls: 15, roadblock: 'stuck' }), d: day({ calls: 15, roadblock: 'stuck' })
    });
    expect(text).toMatch(/held up/);
    expect(text).not.toMatch(/lower/);
  });
});
