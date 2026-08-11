/**
 * Prefill for the broker's Google Form.
 *
 * The form is "Vision & Velocity Business Coaching: You, Amplified!", headed
 * "To be filled out prior to every session!". Responses land in a Sheet the
 * broker owns, shared across all of his coaching clients.
 *
 * Rather than replace that, the app fills it: `prefillUrl()` produces a link
 * that opens his real form with every answer already populated, for the agent
 * to review and submit. His workflow does not change at all.
 *
 * Entry IDs were read from the live form. If he ever edits the form, a question
 * may get a NEW id and its answer will silently stop prefilling — re-read them
 * from the form HTML (`FB_PUBLIC_LOAD_DATA_`) if an answer goes missing.
 */
import { activityLine } from './sessions.js';

export const FORM_ID = '1FAIpQLSeRX0tC-eAyw5xg5Q_tfuDHfm4JdQB7S_8IxIiShTtM68E5MA';
export const FORM_URL = `https://docs.google.com/forms/d/e/${FORM_ID}/viewform`;

export const ENTRY = {
  name: 'entry.1637240913',
  date: 'entry.1503886458',
  feeling: 'entry.1972517507',
  winSinceLastSession: 'entry.104601807',
  belief: 'entry.302661234',
  committedTo: 'entry.466248399',
  progressMade: 'entry.749058209',
  slowedDown: 'entry.636504194',
  activitySnapshot: 'entry.1392681220',
  productionYtd: 'entry.157265804',
  progressTowardGoals: 'entry.1488480897',
  topOpportunities: 'entry.1952521781',
  whatToActOn: 'entry.1836561752',
  nextSteps: 'entry.167822416',
  threeActions: 'entry.391117310',
  supportNeeded: 'entry.1532669317',
  notes: 'entry.1609726349'
};

/** Field order as it appears on the form, for the review screen. */
export const FIELD_ORDER = [
  { key: 'name', label: 'Your Name', group: '' },
  { key: 'date', label: 'Date', group: '' },
  { key: 'feeling', label: 'How are you feeling today?', group: 'Mindset Check In' },
  { key: 'winSinceLastSession', label: 'One win since last session', group: 'Mindset Check In' },
  { key: 'belief', label: 'One thought or belief affecting your momentum', group: 'Mindset Check In' },
  { key: 'committedTo', label: 'What I committed to...', group: 'Review of Last Session' },
  { key: 'progressMade', label: 'Progress made', group: 'Review of Last Session' },
  { key: 'slowedDown', label: 'What slowed me down?', group: 'Review of Last Session' },
  {
    key: 'activitySnapshot',
    label: 'Notes / Calls / Texts / Videos / Social Posts / Pop-Bys / Client Parties / Coffee',
    group: 'Activity and Production Snapshot'
  },
  {
    key: 'productionYtd',
    label: 'Year to Date: # Active Listings / # Pendings / # Closings',
    group: 'Activity and Production Snapshot'
  },
  {
    key: 'progressTowardGoals',
    label: 'Progress toward goals',
    group: 'Activity and Production Snapshot'
  },
  { key: 'topOpportunities', label: 'Top opportunities', group: 'Pipeline Focus' },
  { key: 'whatToActOn', label: 'What I need to act on', group: 'Pipeline Focus' },
  { key: 'nextSteps', label: 'Next steps and timing', group: 'Pipeline Focus' },
  { key: 'threeActions', label: 'Three clear actions', group: 'Action Plan' },
  { key: 'supportNeeded', label: 'Support needed', group: 'Action Plan' },
  { key: 'notes', label: 'Notes', group: '' }
];

/** Every field on the form is required, so an empty one is worth warning about. */
export const REQUIRED_KEYS = FIELD_ORDER.map((f) => f.key);

/**
 * Assemble every form answer. Anything the agent typed on the session screen
 * wins; everything else is derived from the nightly logs.
 *
 * `goalsSummary` arrives already built (see lib/goals.js `goalsNarrative`),
 * because working it out needs the daily log and the coaching cycle, neither of
 * which this module has any business knowing about.
 */
export function buildFormAnswers({ session, review, goalsSummary = '', name }) {
  const p = session.production;

  return {
    name: name || '',
    date: session.date,
    feeling: session.mindset.feeling,
    winSinceLastSession: session.mindset.winSinceLastSession,
    belief: session.mindset.belief,
    committedTo: review.committedTo,
    progressMade: session.review.progressMade || review.progressMade,
    slowedDown: session.review.slowedDown || review.slowedDown,
    activitySnapshot: activityLine(review.summary),
    // The three counts the form names, in its order. Leases have no box of
    // their own, so they are appended to the same free-text answer — and only
    // when there are some, so a lease-free cycle reads exactly as it always
    // did. This mirrors what was already being written in by hand.
    productionYtd:
      `Active Listings: ${p.activeListings} / Pendings: ${p.pendings} / Closings: ${p.closings}` +
      (p.leases ? ` / Leases: ${p.leases}` : ''),
    progressTowardGoals: session.goalsNote || goalsSummary,
    topOpportunities: session.pipeline.topOpportunities,
    whatToActOn: session.pipeline.whatToActOn,
    nextSteps: session.pipeline.nextSteps,
    threeActions: session.commitments
      .filter((c) => c.text)
      .map((c, i) => `${i + 1}. ${c.text}`)
      .join('\n'),
    supportNeeded: session.supportNeeded,
    notes: session.notes
  };
}

/** Which required answers are still blank. */
export const missingAnswers = (answers) =>
  REQUIRED_KEYS.filter((key) => !String(answers[key] ?? '').trim());

/**
 * A link that opens the broker's form with these answers filled in.
 * Verified against the live form: text and paragraph fields take the value
 * directly, and the date field takes YYYY-MM-DD.
 */
export function prefillUrl(answers) {
  const params = new URLSearchParams({ usp: 'pp_url' });
  for (const [key, entryId] of Object.entries(ENTRY)) {
    const value = answers[key];
    if (value !== undefined && value !== null && String(value).trim()) {
      params.set(entryId, String(value));
    }
  }
  return `${FORM_URL}?${params.toString()}`;
}

/** Plain-text version, for pasting anywhere the link is not wanted. */
export function plainText(answers) {
  let out = '';
  let group = null;
  for (const field of FIELD_ORDER) {
    if (field.group && field.group !== group) {
      group = field.group;
      out += `\n${group.toUpperCase()}\n`;
    }
    out += `${field.label}\n${answers[field.key] || '—'}\n\n`;
  }
  return out.trim();
}
