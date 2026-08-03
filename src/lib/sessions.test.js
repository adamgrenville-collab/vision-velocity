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
  // `today` is pinned so these assert cadence logic, not the wall clock.
  it('falls back to a fortnight for the very first session', () => {
    const first = session('2026-08-15');
    expect(windowForSession([first], first, '2026-08-15')).toHaveLength(DEFAULT_CYCLE_DAYS);
  });

  it('covers exactly the days since the previous session', () => {
    const prev = session('2026-08-01');
    const now = session('2026-08-15');
    const window = windowForSession([prev, now], now, '2026-08-15');
    expect(window[0]).toBe('2026-08-02');
    expect(window[window.length - 1]).toBe('2026-08-15');
    expect(window).toHaveLength(14);
  });

  it('stretches when a session slips late', () => {
    const prev = session('2026-08-01');
    const now = session('2026-08-26');
    expect(windowForSession([prev, now], now, '2026-08-26')).toHaveLength(25);
  });

  it('shrinks when a session happens early', () => {
    const prev = session('2026-08-01');
    const now = session('2026-08-08');
    expect(windowForSession([prev, now], now, '2026-08-08')).toHaveLength(7);
  });

  it('never double-counts the previous session day', () => {
    const prev = session('2026-08-01');
    const now = session('2026-08-15');
    expect(windowForSession([prev, now], now, '2026-08-15')).not.toContain('2026-08-01');
  });

  it('returns nothing for a session with no date', () => {
    expect(windowForSession([], blankSession(''))).toEqual([]);
  });
});

describe('windowForSession — a scheduled session does not blank the snapshot', () => {
  // Regression: with the session two weeks out and no previous session, the
  // window used to run backwards FROM the future date, so every day already
  // logged fell outside it and the whole snapshot read zero.
  it('includes today when the first session is scheduled ahead', () => {
    const upcoming = session('2026-08-17');
    const window = windowForSession([upcoming], upcoming, '2026-08-03');
    expect(window).toContain('2026-08-03');
    expect(window[window.length - 1]).toBe('2026-08-03');
  });

  it('never reports on days that have not happened yet', () => {
    const upcoming = session('2026-08-17');
    const window = windowForSession([upcoming], upcoming, '2026-08-03');
    expect(window.filter((k) => k > '2026-08-03')).toEqual([]);
  });

  it('counts consistency against elapsed days only', () => {
    const prev = session('2026-08-01');
    const upcoming = session('2026-08-17');
    // Four days have elapsed since the last session, not sixteen.
    expect(windowForSession([prev, upcoming], upcoming, '2026-08-05')).toEqual([
      '2026-08-02',
      '2026-08-03',
      '2026-08-04',
      '2026-08-05'
    ]);
  });

  it('still covers the full span once the session date has passed', () => {
    const prev = session('2026-08-01');
    const past = session('2026-08-15');
    expect(windowForSession([prev, past], past, '2026-08-20')).toHaveLength(14);
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

  // Pinned so the assertions describe the review logic, not the wall clock.
  const AT = '2026-08-15';

  it('carries last session’s commitments forward verbatim', () => {
    const { committedTo } = deriveReview([prev, now], now, entries, AT);
    expect(committedTo).toContain('1. Call 10 past clients');
    expect(committedTo).toContain('3. Host a pop-by run');
  });

  it('says so when there is no previous session', () => {
    const { committedTo } = deriveReview([now], now, entries, AT);
    expect(committedTo).toContain('no commitments recorded');
  });

  it('scores the commitments that were kept', () => {
    const { progressMade } = deriveReview([prev, now], now, entries, AT);
    expect(progressMade).toContain('Completed 2 of 3 commitments');
    expect(progressMade).toContain('✔ Call 10 past clients');
    expect(progressMade).toContain('○ still open: Host a pop-by run');
  });

  it('reports consistency over the actual window', () => {
    const { progressMade } = deriveReview([prev, now], now, entries, AT);
    expect(progressMade).toContain('Logged 2 of 14 days');
    expect(progressMade).toContain('actions completed: 2 of 3');
  });

  it('collects the roadblocks instead of asking you to remember them', () => {
    const { slowedDown } = deriveReview([prev, now], now, entries, AT);
    expect(slowedDown).toContain('08-05 — Lost a day to inspections');
    expect(slowedDown).toContain('08-09 — Head not in it');
  });

  it('leaves roadblocks blank when none were logged', () => {
    expect(deriveReview([prev, now], now, {}, AT).slowedDown).toBe('');
  });

  it('only counts days inside the window', () => {
    const outside = { ...entries, '2026-07-20': migrateEntry({ activities: { calls: 99 } }) };
    const { summary } = deriveReview([prev, now], now, outside, AT);
    expect(summary.conversations).toBe(22);
  });

  it('reports on elapsed days only when the session is still ahead', () => {
    // Mid-cycle: the session is a week away, so the window stops at today and
    // the Aug 9 entry — which has not happened yet — is correctly excluded.
    const { progressMade, windowKeys, summary } = deriveReview([prev, now], now, entries, '2026-08-08');
    expect(windowKeys[windowKeys.length - 1]).toBe('2026-08-08');
    expect(windowKeys).not.toContain('2026-08-09');
    expect(progressMade).toContain('Logged 1 of 7 days');
    expect(summary.conversations).toBe(16);
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
