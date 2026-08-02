import { describe, it, expect } from 'vitest';
import {
  blankSession,
  migrateSession,
  migrateSessions,
  previousSession,
  windowForSession,
  ytdKeys,
  deriveReview,
  activityLine,
  suggestedClosings,
  DEFAULT_CYCLE_DAYS
} from './sessions.js';
import { migrateEntry, summarize } from './entries.js';

const session = (date, over = {}) => migrateSession({ ...blankSession(date), date, ...over });

describe('migrateSession — never throws', () => {
  const garbage = [
    undefined, null, 0, 'string', [], true,
    { date: 'not-a-date' }, { mindset: null }, { commitments: 'nope' },
    { production: [] }, { pipeline: 42 }
  ];
  for (const input of garbage) {
    it(`survives ${JSON.stringify(input) ?? String(input)}`, () => {
      const s = migrateSession(input);
      expect(s.commitments).toHaveLength(3);
      expect(typeof s.mindset.feeling).toBe('string');
      expect(typeof s.production.activeListings).toBe('number');
    });
  }

  it('keeps a valid date and rejects a malformed one', () => {
    expect(migrateSession({ date: '2026-08-15' }).date).toBe('2026-08-15');
    expect(migrateSession({ date: '15/08/2026' }).date).toBe('');
  });
});

describe('migrateSessions', () => {
  it('drops sessions with no usable date', () => {
    const out = migrateSessions([{ date: '2026-08-15' }, { date: 'junk' }, null]);
    expect(out).toHaveLength(1);
  });

  it('returns empty for non-arrays', () => {
    expect(migrateSessions(null)).toEqual([]);
    expect(migrateSessions({})).toEqual([]);
  });
});

describe('previousSession', () => {
  const all = [session('2026-08-15'), session('2026-07-18'), session('2026-08-01')];

  it('finds the nearest earlier session regardless of array order', () => {
    expect(previousSession(all, '2026-08-15').date).toBe('2026-08-01');
  });

  it('returns null for the first session', () => {
    expect(previousSession(all, '2026-07-18')).toBeNull();
  });

  it('does not treat a same-day session as previous', () => {
    expect(previousSession(all, '2026-08-01').date).toBe('2026-07-18');
  });
});

describe('windowForSession — cadence is not assumed', () => {
  it('falls back to a fortnight for the very first session', () => {
    const first = session('2026-08-15');
    expect(windowForSession([first], first)).toHaveLength(DEFAULT_CYCLE_DAYS);
  });

  it('covers exactly the days since the previous session', () => {
    const prev = session('2026-08-01');
    const now = session('2026-08-15');
    const window = windowForSession([prev, now], now);
    expect(window[0]).toBe('2026-08-02');
    expect(window[window.length - 1]).toBe('2026-08-15');
    expect(window).toHaveLength(14);
  });

  it('stretches when a session slips late', () => {
    const prev = session('2026-08-01');
    const now = session('2026-08-26');
    expect(windowForSession([prev, now], now)).toHaveLength(25);
  });

  it('shrinks when a session happens early', () => {
    const prev = session('2026-08-01');
    const now = session('2026-08-08');
    expect(windowForSession([prev, now], now)).toHaveLength(7);
  });

  it('never double-counts the previous session day', () => {
    const prev = session('2026-08-01');
    const now = session('2026-08-15');
    expect(windowForSession([prev, now], now)).not.toContain('2026-08-01');
  });

  it('returns nothing for a session with no date', () => {
    expect(windowForSession([], blankSession(''))).toEqual([]);
  });
});

describe('ytdKeys', () => {
  it('starts at January 1st', () => {
    const keys = ytdKeys('2026-03-01');
    expect(keys[0]).toBe('2026-01-01');
    expect(keys[keys.length - 1]).toBe('2026-03-01');
  });

  it('is one day long on January 1st', () => {
    expect(ytdKeys('2026-01-01')).toEqual(['2026-01-01']);
  });

  it('handles a leap year', () => {
    expect(ytdKeys('2024-12-31')).toHaveLength(366);
  });

  it('handles a normal year', () => {
    expect(ytdKeys('2026-12-31')).toHaveLength(365);
  });

  it('returns nothing for a malformed key', () => {
    expect(ytdKeys('nope')).toEqual([]);
  });
});

describe('deriveReview — the review block assembles itself', () => {
  const prev = session('2026-08-01', {
    commitments: [
      { text: 'Call 10 past clients', done: true },
      { text: 'Film a market update', done: true },
      { text: 'Host a pop-by run', done: false }
    ]
  });
  const now = session('2026-08-15');
  const entries = {
    '2026-08-05': migrateEntry({
      activities: { calls: 12, texts: 4 },
      mindset: { roadblock: 'Lost a day to inspections' },
      actionPlan: [{ text: 'a', done: true }, { text: 'b', done: false }]
    }),
    '2026-08-09': migrateEntry({
      activities: { calls: 6 },
      mindset: { roadblock: 'Head not in it' },
      actionPlan: [{ text: 'c', done: true }]
    })
  };

  it('carries last session’s commitments forward verbatim', () => {
    const { committedTo } = deriveReview([prev, now], now, entries);
    expect(committedTo).toContain('1. Call 10 past clients');
    expect(committedTo).toContain('3. Host a pop-by run');
  });

  it('says so when there is no previous session', () => {
    const { committedTo } = deriveReview([now], now, entries);
    expect(committedTo).toContain('no commitments recorded');
  });

  it('scores the commitments that were kept', () => {
    const { progressMade } = deriveReview([prev, now], now, entries);
    expect(progressMade).toContain('Completed 2 of 3 commitments');
    expect(progressMade).toContain('✔ Call 10 past clients');
    expect(progressMade).toContain('○ still open: Host a pop-by run');
  });

  it('reports consistency over the actual window', () => {
    const { progressMade } = deriveReview([prev, now], now, entries);
    expect(progressMade).toContain('Logged 2 of 14 days');
    expect(progressMade).toContain('actions completed: 2 of 3');
  });

  it('collects the roadblocks instead of asking you to remember them', () => {
    const { slowedDown } = deriveReview([prev, now], now, entries);
    expect(slowedDown).toContain('08-05 — Lost a day to inspections');
    expect(slowedDown).toContain('08-09 — Head not in it');
  });

  it('leaves roadblocks blank when none were logged', () => {
    expect(deriveReview([prev, now], now, {}).slowedDown).toBe('');
  });

  it('only counts days inside the window', () => {
    const outside = { ...entries, '2026-07-20': migrateEntry({ activities: { calls: 99 } }) };
    const { summary } = deriveReview([prev, now], now, outside);
    expect(summary.conversations).toBe(22);
  });
});

describe('activityLine', () => {
  it('lists every activity in the order the broker’s form uses', () => {
    const summary = summarize(
      { d: migrateEntry({ activities: { notes: 1, calls: 2, texts: 3, coffee: 4 } }) },
      ['d']
    );
    expect(activityLine(summary)).toBe(
      'Notes: 1 / Calls: 2 / Texts: 3 / Videos: 0 / Social Posts: 0 / Pop-Bys: 0 / Client Parties: 0 / Coffee: 4'
    );
  });
});

describe('suggestedClosings', () => {
  it('totals closings from the start of the year', () => {
    const entries = {
      '2026-02-10': migrateEntry({ production: { closings: 2 } }),
      '2026-07-01': migrateEntry({ production: { closings: 3 } }),
      '2025-12-30': migrateEntry({ production: { closings: 9 } })
    };
    expect(suggestedClosings(entries, '2026-08-15')).toBe(5);
  });
});
