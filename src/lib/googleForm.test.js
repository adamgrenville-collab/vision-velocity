import { describe, it, expect } from 'vitest';
import {
  ENTRY,
  FIELD_ORDER,
  buildFormAnswers,
  prefillUrl,
  missingAnswers,
  plainText,
  FORM_URL
} from './googleForm.js';
import { blankSession, migrateSession, deriveReview } from './sessions.js';
import { migrateEntry } from './entries.js';

const prev = migrateSession({
  ...blankSession('2026-08-01'),
  date: '2026-08-01',
  commitments: [
    { text: 'Call 10 past clients', done: true },
    { text: 'Film a market update', done: false },
    { text: '', done: false }
  ]
});

const now = migrateSession({
  ...blankSession('2026-08-15'),
  date: '2026-08-15',
  mindset: { feeling: 'Steady', winSinceLastSession: 'Took the Oak St listing', belief: 'I under-ask' },
  production: { activeListings: 4, pendings: 2, closings: 11 },
  pipeline: { topOpportunities: 'Hendersons', whatToActOn: 'Price drop', nextSteps: 'Call Tuesday' },
  commitments: [
    { text: 'Twenty calls', done: false },
    { text: 'Two pop-bys', done: false },
    { text: 'Record a video', done: false }
  ],
  supportNeeded: 'Scripts for price reductions',
  notes: 'Feeling better about the pipeline'
});

const entries = {
  '2026-08-05': migrateEntry({
    activities: { notes: 2, calls: 12, texts: 4, coffee: 1 },
    mindset: { roadblock: 'Lost a day to inspections' }
  })
};

const review = deriveReview([prev, now], now, entries);
const goals = [
  { label: 'Listings taken', target: 20, current: 11, unit: '' },
  { label: 'Gym', target: 4, current: 3, unit: 'sessions/wk' },
  { label: 'Read', target: 0, current: 2, unit: 'books' }
];

describe('field ids', () => {
  it('has an entry id for every field on the form', () => {
    for (const field of FIELD_ORDER) {
      expect(ENTRY[field.key], `missing entry id for ${field.key}`).toMatch(/^entry\.\d+$/);
    }
  });

  it('has no duplicate entry ids', () => {
    const ids = Object.values(ENTRY);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('buildFormAnswers', () => {
  const answers = buildFormAnswers({ session: now, review, goals, name: 'Adam Grenville' });

  it('fills the identity fields', () => {
    expect(answers.name).toBe('Adam Grenville');
    expect(answers.date).toBe('2026-08-15');
  });

  it('formats activity the way the form asks for it', () => {
    expect(answers.activitySnapshot).toContain('Calls: 12');
    expect(answers.activitySnapshot).toContain('Coffee: 1');
    expect(answers.activitySnapshot).toContain('Videos: 0');
  });

  it('formats year-to-date production as the form labels it', () => {
    expect(answers.productionYtd).toBe('Active Listings: 4 / Pendings: 2 / Closings: 11');
  });

  it('carries last session’s commitments into "what I committed to"', () => {
    expect(answers.committedTo).toContain('1. Call 10 past clients');
  });

  it('numbers this session’s three actions', () => {
    expect(answers.threeActions).toBe('1. Twenty calls\n2. Two pop-bys\n3. Record a video');
  });

  it('skips blank commitments when numbering', () => {
    const sparse = migrateSession({
      ...now,
      commitments: [{ text: 'Only one', done: false }, { text: '', done: false }, { text: '', done: false }]
    });
    const out = buildFormAnswers({ session: sparse, review, goals, name: 'A' });
    expect(out.threeActions).toBe('1. Only one');
  });

  it('summarises goals, including ones with no numeric target', () => {
    expect(answers.progressTowardGoals).toContain('Listings taken: 11 of 20 (55%)');
    expect(answers.progressTowardGoals).toContain('Gym: 3 of 4 sessions/wk (75%)');
    expect(answers.progressTowardGoals).toContain('Read: 2 books');
  });

  it('prefers what the agent typed over what was derived', () => {
    const edited = migrateSession({ ...now, review: { progressMade: 'My own words', slowedDown: 'Mine too' } });
    const out = buildFormAnswers({ session: edited, review, goals, name: 'A' });
    expect(out.progressMade).toBe('My own words');
    expect(out.slowedDown).toBe('Mine too');
  });

  it('falls back to the derived review when the agent typed nothing', () => {
    expect(answers.progressMade).toContain('Completed 1 of 2 commitments');
    expect(answers.slowedDown).toContain('Lost a day to inspections');
  });
});

describe('missingAnswers', () => {
  it('is empty when everything is filled', () => {
    const complete = buildFormAnswers({ session: now, review, goals, name: 'Adam' });
    expect(missingAnswers(complete)).toEqual([]);
  });

  it('names the blanks, since every form field is required', () => {
    const bare = buildFormAnswers({ session: blankSession('2026-08-15'), review, goals, name: '' });
    const missing = missingAnswers(bare);
    expect(missing).toContain('name');
    expect(missing).toContain('feeling');
    expect(missing).toContain('topOpportunities');
  });

  it('treats whitespace as blank', () => {
    expect(missingAnswers({ name: '   ' })).toContain('name');
  });
});

describe('prefillUrl', () => {
  const answers = buildFormAnswers({ session: now, review, goals, name: 'Adam Grenville' });
  const url = prefillUrl(answers);

  it('points at the broker’s form', () => {
    expect(url.startsWith(`${FORM_URL}?`)).toBe(true);
    expect(url).toContain('usp=pp_url');
  });

  it('is a viewform link, never a submit endpoint', () => {
    expect(url).toContain('/viewform');
    expect(url).not.toContain('formResponse');
  });

  it('carries each answer under its entry id', () => {
    const parsed = new URL(url);
    expect(parsed.searchParams.get(ENTRY.name)).toBe('Adam Grenville');
    expect(parsed.searchParams.get(ENTRY.date)).toBe('2026-08-15');
    expect(parsed.searchParams.get(ENTRY.supportNeeded)).toBe('Scripts for price reductions');
  });

  it('round-trips newlines in multi-line answers', () => {
    const parsed = new URL(prefillUrl(answers));
    expect(parsed.searchParams.get(ENTRY.threeActions)).toBe(
      '1. Twenty calls\n2. Two pop-bys\n3. Record a video'
    );
  });

  it('escapes characters that would otherwise break the query string', () => {
    const tricky = prefillUrl({ name: 'A&B #1 ?x=1', date: '2026-08-15' });
    expect(new URL(tricky).searchParams.get(ENTRY.name)).toBe('A&B #1 ?x=1');
  });

  it('omits blank answers rather than sending empty params', () => {
    const parsed = new URL(prefillUrl({ name: 'Adam', feeling: '' }));
    expect(parsed.searchParams.has(ENTRY.feeling)).toBe(false);
  });
});

describe('plainText', () => {
  it('groups the answers under the form’s own headings', () => {
    const text = plainText(buildFormAnswers({ session: now, review, goals, name: 'Adam' }));
    expect(text).toContain('MINDSET CHECK IN');
    expect(text).toContain('PIPELINE FOCUS');
    expect(text).toContain('Took the Oak St listing');
  });

  it('marks blanks rather than dropping the label', () => {
    expect(plainText({})).toContain('—');
  });
});
