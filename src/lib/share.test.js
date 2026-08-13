import { describe, it, expect } from 'vitest';
import { newToken, isToken, buildSnapshot, cleanNote, addNote, unreadCount } from './share.js';
import { migrateEntry } from './entries.js';

const doc = () => ({
  entries: {
    '2026-08-03': migrateEntry({
      activities: { calls: 12, texts: 4 },
      mindset: { feeling: 'sharp', win: 'Took Oak St' },
      actionPlan: [{ text: 'a', done: true }, { text: 'b', done: false }]
    }),
    '2026-08-06': migrateEntry({
      activities: { calls: 3 },
      production: { closings: 1, leases: 2 },
      mindset: { roadblock: 'no leads' }
    })
  },
  sessions: [
    {
      id: 'prev',
      date: '2026-08-01',
      commitments: [
        { text: 'Call 10 past clients', done: true },
        { text: 'Film a market update', done: false }
      ]
    },
    { id: 'next', date: '2026-08-15' }
  ],
  profile: {
    name: 'Adam Grenville',
    goals: [{ id: 'g', label: 'Sides', metric: 'sides', target: 24, period: 'year' }]
  }
});

describe('tokens', () => {
  it('produces 32 hex characters', () => {
    expect(newToken()).toMatch(/^[0-9a-f]{32}$/);
  });

  it('does not repeat', () => {
    const seen = new Set(Array.from({ length: 200 }, newToken));
    expect(seen.size).toBe(200);
  });

  it('validates shape strictly', () => {
    expect(isToken(newToken())).toBe(true);
    for (const bad of ['', 'abc', null, undefined, 42, 'A'.repeat(32), '../etc/passwd', `${newToken()}x`]) {
      expect(isToken(bad)).toBe(false);
    }
  });
});

describe('buildSnapshot', () => {
  const snap = buildSnapshot(doc(), '2026-08-10');

  it('identifies the agent', () => {
    expect(snap.name).toBe('Adam Grenville');
  });

  it('covers the days since the previous session', () => {
    expect(snap.cycle.previousSession).toBe('2026-08-01');
    expect(snap.cycle.nextSession).toBe('2026-08-15');
    expect(snap.cycle.start).toBe('2026-08-02');
    expect(snap.cycle.daysLogged).toBe(2);
  });

  it('totals activity and production', () => {
    expect(snap.activity.calls).toBe(15);
    expect(snap.conversations).toBe(19);
    expect(snap.production.closings).toBe(1);
    expect(snap.sides).toBe(2);
  });

  it('carries what was committed to last session', () => {
    expect(snap.commitments.lastSession).toHaveLength(2);
    expect(snap.commitments.lastSession[0].text).toBe('Call 10 past clients');
  });

  it('scores daily follow-through', () => {
    expect(snap.commitments.set).toBe(2);
    expect(snap.commitments.done).toBe(1);
  });

  it('includes mindset, because that is what was shared', () => {
    expect(snap.mindset.checkedIn).toBe(2);
    expect(snap.mindset.wins[0].text).toBe('Took Oak St');
    expect(snap.mindset.roadblocks[0].text).toBe('no leads');
    expect(snap.mindset.narrative).toMatch(/Checked in on 2 days/);
  });

  it('tabulates goals', () => {
    expect(snap.goals[0].goals[0].label).toBe('Sides');
    expect(snap.goals[0].goals[0].current).toBe(2);
  });

  it('reports standards, which exist by default for everyone', () => {
    // migrateStandards supplies defaults deliberately, so a new agent gets a
    // starting standard rather than an empty panel.
    expect(snap.standards).not.toBeNull();
    expect(typeof snap.standards.streak).toBe('number');
    expect(typeof snap.standards.adherence.pct).toBe('number');
  });

  it('omits standards only when the agent has zeroed every one', () => {
    const noneSet = doc();
    noneSet.profile.standards = Object.fromEntries(
      ['notes', 'calls', 'texts', 'videos', 'socialPosts', 'popBys', 'clientParties', 'coffee'].map(
        (k) => [k, { daily: 0, weekly: 0 }]
      )
    );
    expect(buildSnapshot(noneSet, '2026-08-10').standards).toBeNull();
  });

  it('never leaks the raw document', () => {
    const json = JSON.stringify(snap);
    expect(json).not.toMatch(/updatedAt/);
    expect(snap.entries).toBeUndefined();
    expect(snap.profile).toBeUndefined();
  });

  it('survives an empty or malformed document', () => {
    for (const bad of [null, undefined, {}, { entries: 'x', sessions: 'y', profile: 3 }]) {
      const s = buildSnapshot(bad, '2026-08-10');
      expect(s.cycle.daysLogged).toBe(0);
      expect(s.mindset.checkedIn).toBe(0);
      expect(Array.isArray(s.goals)).toBe(true);
    }
  });
});

describe('cleanNote', () => {
  it('keeps a real note', () => {
    const n = cleanNote({ author: 'Mike', text: 'Great fortnight — keep the calls up.' }, 1000);
    expect(n.author).toBe('Mike');
    expect(n.text).toMatch(/Great fortnight/);
    expect(n.at).toBe(1000);
    expect(isToken(n.id)).toBe(true);
  });

  it('rejects an empty note rather than storing whitespace', () => {
    expect(cleanNote({ text: '   ' }, 1)).toBeNull();
    expect(cleanNote({}, 1)).toBeNull();
    expect(cleanNote(null, 1)).toBeNull();
  });

  it('falls back to a sensible author', () => {
    expect(cleanNote({ text: 'hi' }, 1).author).toBe('Your mentor');
  });

  it('caps length so one post cannot bloat the record', () => {
    const n = cleanNote({ author: 'x'.repeat(500), text: 'y'.repeat(9000) }, 1);
    expect(n.text.length).toBe(2000);
    expect(n.author.length).toBe(80);
  });

  it('coerces non-string input', () => {
    expect(cleanNote({ text: 42, author: {} }, 1)).toBeNull();
  });
});

describe('addNote', () => {
  it('puts the newest first', () => {
    const a = cleanNote({ text: 'first' }, 1);
    const b = cleanNote({ text: 'second' }, 2);
    expect(addNote(addNote([], a), b)[0].text).toBe('second');
  });

  it('caps the list so it cannot grow without bound', () => {
    let list = [];
    for (let i = 0; i < 250; i += 1) list = addNote(list, cleanNote({ text: `n${i}` }, i), 200);
    expect(list).toHaveLength(200);
    expect(list[0].text).toBe('n249');
  });

  it('tolerates a corrupt existing list', () => {
    expect(addNote('nope', cleanNote({ text: 'x' }, 1))).toHaveLength(1);
  });
});

describe('unreadCount', () => {
  const notes = [{ at: 300 }, { at: 200 }, { at: 100 }];

  it('counts notes newer than last seen', () => {
    expect(unreadCount(notes, 150)).toBe(2);
  });

  it('counts everything when nothing has been seen', () => {
    expect(unreadCount(notes)).toBe(3);
  });

  it('counts nothing when all are seen', () => {
    expect(unreadCount(notes, 300)).toBe(0);
  });

  it('handles rubbish', () => {
    expect(unreadCount(null, 0)).toBe(0);
    expect(unreadCount([{}, null], 0)).toBe(0);
  });
});
