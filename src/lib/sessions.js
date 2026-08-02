/**
 * Coaching sessions.
 *
 * A session is the unit the whole app exists to serve: every fortnight-ish the
 * agent fills in their broker's Google Form and sits down with him. Nightly logs
 * are the raw material; this module turns a span of them into the answers.
 *
 * The window between sessions is deliberately NOT a fixed 14 days. Real cadence
 * slips with schedules and conflicts, so a session's snapshot covers the days
 * since the previous session actually happened.
 */
import { keysInWindow, summarize, ACTIVITY_KEYS } from './entries.js';

export const DEFAULT_CYCLE_DAYS = 14;

const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const toText = (v) => (typeof v === 'string' ? v : '');
const toCount = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0;
};

function newId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `s-${Math.floor(Math.random() * 1e12).toString(36)}`;
}

export function blankSession(date) {
  return {
    id: newId(),
    date: toText(date),
    mindset: { feeling: '', winSinceLastSession: '', belief: '' },
    review: { progressMade: '', slowedDown: '' },
    // "Year to Date: # Active Listings / # Pendings / # Closings".
    // Active and pending are point-in-time states that cannot be derived from
    // event counters, so they are confirmed by the agent each session.
    production: { activeListings: 0, pendings: 0, closings: 0 },
    goalsNote: '',
    pipeline: { topOpportunities: '', whatToActOn: '', nextSteps: '' },
    commitments: [
      { text: '', done: false },
      { text: '', done: false },
      { text: '', done: false }
    ],
    supportNeeded: '',
    notes: '',
    // Captured during or after the meeting — these never go on the form,
    // which is filled in beforehand.
    brokerFeedback: '',
    myTakeaways: '',
    submitted: false
  };
}

export function migrateSession(raw) {
  const session = blankSession('');
  if (!isObject(raw)) return session;

  session.id = toText(raw.id) || session.id;
  session.date = /^\d{4}-\d{2}-\d{2}$/.test(raw.date) ? raw.date : '';

  for (const key of Object.keys(session.mindset)) session.mindset[key] = toText(raw.mindset?.[key]);
  for (const key of Object.keys(session.review)) session.review[key] = toText(raw.review?.[key]);
  for (const key of Object.keys(session.production)) {
    session.production[key] = toCount(raw.production?.[key]);
  }
  for (const key of Object.keys(session.pipeline)) session.pipeline[key] = toText(raw.pipeline?.[key]);

  if (Array.isArray(raw.commitments)) {
    session.commitments = session.commitments.map((slot, i) => {
      const item = raw.commitments[i];
      if (!isObject(item)) return slot;
      return { text: toText(item.text), done: item.done === true };
    });
  }

  session.goalsNote = toText(raw.goalsNote);
  session.supportNeeded = toText(raw.supportNeeded);
  session.notes = toText(raw.notes);
  session.brokerFeedback = toText(raw.brokerFeedback);
  session.myTakeaways = toText(raw.myTakeaways);
  session.submitted = raw.submitted === true;

  return session;
}

export function migrateSessions(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map(migrateSession).filter((s) => s.date);
}

/** Oldest first. */
export const sortSessions = (sessions) => [...sessions].sort((a, b) => a.date.localeCompare(b.date));

/** The session immediately before `date`, or null. */
export function previousSession(sessions, date) {
  const earlier = sortSessions(sessions).filter((s) => s.date < date);
  return earlier.length ? earlier[earlier.length - 1] : null;
}

/** The session immediately after `date`, or null. */
export function nextSession(sessions, date) {
  return sortSessions(sessions).find((s) => s.date >= date) || null;
}

/**
 * Every date key covered by a session: the day after the previous session up to
 * and including the session date. Falls back to a fortnight for the first one.
 */
export function windowForSession(sessions, session) {
  if (!session?.date) return [];
  const prev = previousSession(sessions, session.date);
  if (!prev) return keysInWindow(session.date, DEFAULT_CYCLE_DAYS);

  const all = keysInWindow(session.date, 400);
  const start = all.indexOf(prev.date);
  // Exclude the previous session's own day; it was already reported on.
  return start === -1 ? keysInWindow(session.date, DEFAULT_CYCLE_DAYS) : all.slice(start + 1);
}

/** Date keys from Jan 1 of the session's year through the session date. */
export function ytdKeys(dateKey) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return [];
  const [year, month, day] = dateKey.split('-').map(Number);
  const dayOfYear = Math.round((new Date(year, month - 1, day) - new Date(year, 0, 1)) / 86400000) + 1;
  return keysInWindow(dateKey, dayOfYear);
}

/**
 * The "Review of Last Session" block, assembled rather than remembered.
 * Returns the text for each of the form's three review answers.
 */
export function deriveReview(sessions, session, entriesByDate) {
  const prev = previousSession(sessions, session.date);
  const committed = (prev?.commitments || []).filter((c) => c.text);

  const committedTo = committed.length
    ? committed.map((c, i) => `${i + 1}. ${c.text}`).join('\n')
    : '(no commitments recorded from the previous session)';

  const windowKeys = windowForSession(sessions, session);
  const summary = summarize(entriesByDate, windowKeys);

  const done = committed.filter((c) => c.done);
  const open = committed.filter((c) => !c.done);

  const progressLines = [];
  if (committed.length) {
    progressLines.push(`Completed ${done.length} of ${committed.length} commitments.`);
    for (const c of done) progressLines.push(`✔ ${c.text}`);
    for (const c of open) progressLines.push(`○ still open: ${c.text}`);
  }
  progressLines.push(
    `Logged ${summary.daysLogged} of ${windowKeys.length} days. ` +
      `Daily actions completed: ${summary.targetsDone} of ${summary.targetsSet}.`
  );

  const slowedDown = summary.roadblocks.length
    ? summary.roadblocks.map((r) => `${r.date.slice(5)} — ${r.roadblock}`).join('\n')
    : '';

  return { committedTo, progressMade: progressLines.join('\n'), slowedDown, summary, windowKeys };
}

/** The activity line, in the exact order the broker's form lists it. */
export function activityLine(summary) {
  const labels = {
    notes: 'Notes',
    calls: 'Calls',
    texts: 'Texts',
    videos: 'Videos',
    socialPosts: 'Social Posts',
    popBys: 'Pop-Bys',
    clientParties: 'Client Parties',
    coffee: 'Coffee'
  };
  return ACTIVITY_KEYS.map((key) => `${labels[key]}: ${summary.totalActivities[key]}`).join(' / ');
}

/** Suggested year-to-date closings, from the nightly production tallies. */
export function suggestedClosings(entriesByDate, dateKey) {
  return summarize(entriesByDate, ytdKeys(dateKey)).totalProduction.closings;
}
