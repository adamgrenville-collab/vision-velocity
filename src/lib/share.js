/**
 * The read-only picture a mentor sees between sessions.
 *
 * Built from the same stored document the agent's own app uses, so there is no
 * second source of truth to drift. It is assembled server-side and handed over
 * whole: the token holder never gets access to the underlying record, only to
 * this snapshot.
 *
 * The agent chose to share everything, mindset included. That is deliberate and
 * worth stating plainly in the UI rather than burying — someone reading their
 * roadblocks and how they felt at 10pm should be a decision, not a surprise.
 */
import { summarize, ACTIVITY_KEYS, PRODUCTION_KEYS, weightedSides } from './entries.js';
import { mindsetSummary, mindsetNarrative } from './mindset.js';
import { migrateGoals, groupByPeriod } from './goals.js';
import { migrateSessions, previousSession, nextSession, windowForSession } from './sessions.js';
import { migrateStandards, hasAnyStandard, adherence, dailyStreak, bestStreak } from './standards.js';
import { migrateAll } from './entries.js';

/** An unguessable share token. 32 hex characters. */
export function newToken() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

export const isToken = (value) => typeof value === 'string' && /^[0-9a-f]{32}$/.test(value);

/**
 * @param {object} doc   The stored { entries, sessions, profile } document.
 * @param {string} today
 */
export function buildSnapshot(doc, today) {
  const entries = migrateAll(doc?.entries);
  const sessions = migrateSessions(doc?.sessions);
  const profile = doc?.profile && typeof doc.profile === 'object' ? doc.profile : {};
  const standards = migrateStandards(profile.standards);

  const upcoming = nextSession(sessions, today) || null;
  const windowKeys = upcoming
    ? windowForSession(sessions, upcoming, today)
    : Object.keys(entries).sort().slice(-14);

  const summary = summarize(entries, windowKeys);
  const previous = upcoming ? previousSession(sessions, upcoming.date) : null;
  const mindset = mindsetSummary(entries, windowKeys);

  const cycleRange = windowKeys.length
    ? { start: windowKeys[0], end: windowKeys[windowKeys.length - 1] }
    : null;

  const activity = {};
  for (const key of ACTIVITY_KEYS) activity[key] = summary.totalActivities[key];
  const production = {};
  for (const key of PRODUCTION_KEYS) production[key] = summary.totalProduction[key];

  return {
    name: typeof profile.name === 'string' ? profile.name : '',
    generatedFor: today,
    cycle: {
      start: cycleRange?.start || null,
      end: cycleRange?.end || null,
      days: windowKeys.length,
      daysLogged: summary.daysLogged,
      previousSession: previous?.date || null,
      nextSession: upcoming?.date || null
    },
    activity,
    production,
    sides: Math.round(weightedSides(summary.totalProduction) * 10) / 10,
    conversations: summary.conversations,
    totalActivity: summary.totalActivity,
    commitments: {
      set: summary.targetsSet,
      done: summary.targetsDone,
      // What they told their mentor they would do last time.
      lastSession: (previous?.commitments || []).filter((c) => c.text)
    },
    standards: hasAnyStandard(standards)
      ? {
          adherence: adherence(entries, today, standards),
          streak: dailyStreak(entries, today, standards),
          best: bestStreak(entries, today, standards)
        }
      : null,
    goals: groupByPeriod(migrateGoals(profile.goals), entries, today, cycleRange).map((group) => ({
      key: group.key,
      label: group.label,
      goals: group.goals.map((t) => ({
        label: t.goal.label,
        current: t.current,
        target: t.target,
        percent: t.percent,
        delta: t.delta,
        deltaWhole: t.deltaWhole,
        onPace: t.onPace,
        onTrack: t.onTrack,
        finished: t.finished,
        daysLeft: t.daysLeft,
        tracked: t.tracked
      }))
    })),
    mindset: {
      narrative: mindsetNarrative(mindset),
      checkedIn: mindset.checkedIn,
      wins: mindset.wins,
      roadblocks: mindset.roadblocks,
      feelings: mindset.feelings,
      themes: mindset.roadblockThemes,
      effect: mindset.effect
    }
  };
}

const MAX_NOTE = 2000;
const MAX_AUTHOR = 80;

/**
 * Coerce an incoming note. Returns null if there is nothing worth storing.
 *
 * Only real strings are accepted — String() on an object yields
 * "[object Object]", which would be stored and shown to the agent as though
 * their mentor had typed it.
 */
const asText = (value, max) => (typeof value === 'string' ? value.trim().slice(0, max) : '');

export function cleanNote(raw, at) {
  const text = asText(raw?.text, MAX_NOTE);
  if (!text) return null;
  return {
    id: newToken(),
    author: asText(raw?.author, MAX_AUTHOR) || 'Your mentor',
    text,
    at
  };
}

/** Newest first, capped so the record cannot grow without bound. */
export function addNote(existing, note, limit = 200) {
  const list = Array.isArray(existing) ? existing : [];
  return [note, ...list].slice(0, limit);
}

export const unreadCount = (notes, lastSeenAt = 0) =>
  (Array.isArray(notes) ? notes : []).filter((n) => Number(n?.at) > Number(lastSeenAt)).length;
