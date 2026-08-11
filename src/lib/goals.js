/**
 * Goals: outcomes over a period, as distinct from standards.
 *
 * The difference matters and is the reason the first version made no sense:
 *
 *   standards — the inputs you control, judged daily and weekly. Five calls
 *               every morning. Missing one is a miss today.
 *   goals     — the outcome you are working toward over a month, a quarter, a
 *               year or longer. Twenty-four sides. You cannot "do" a side on a
 *               Tuesday; it either happens or it doesn't.
 *
 * A goal counts itself wherever the app already logs the thing being counted.
 * Typing your own progress into a tracking app is data entry that goes stale
 * and then quietly lies to you, so manual goals exist but are the exception.
 */
import { keyToDate, dateToKey, todayKey } from './dates.js';
import { ACTIVITY_KEYS, PRODUCTION_KEYS, weightedSides } from './entries.js';

/** Shortest horizon first — the order they are read in. */
export const PERIODS = [
  { key: 'cycle', label: 'This coaching cycle' },
  { key: 'month', label: 'This month' },
  { key: 'quarter', label: 'This quarter' },
  { key: 'year', label: 'This year' },
  { key: 'custom', label: 'Longer range' }
];

/** Everything a goal can be measured in. `manual` is the escape hatch. */
export const METRICS = [
  { key: 'sides', label: 'Sides (a lease counts as half)', group: 'Production' },
  { key: 'closings', label: 'Closings', group: 'Production' },
  { key: 'listings', label: 'Listings', group: 'Production' },
  { key: 'pendings', label: 'Pendings', group: 'Production' },
  { key: 'leases', label: 'Leases', group: 'Production' },
  { key: 'calls', label: 'Calls', group: 'Activity' },
  { key: 'notes', label: 'Notes', group: 'Activity' },
  { key: 'texts', label: 'Texts', group: 'Activity' },
  { key: 'videos', label: 'Videos', group: 'Activity' },
  { key: 'socialPosts', label: 'Social posts', group: 'Activity' },
  { key: 'popBys', label: 'Pop-bys', group: 'Activity' },
  { key: 'clientParties', label: 'Client parties', group: 'Activity' },
  { key: 'coffee', label: 'Coffee', group: 'Activity' },
  { key: 'manual', label: "Something the app can't count", group: 'Other' }
];

const METRIC_KEYS = new Set(METRICS.map((m) => m.key));
const isObject = (v) => typeof v === 'object' && v !== null && !Array.isArray(v);
const toNumber = (v) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : 0;
};
const isDateKey = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v));

let seq = 0;
const newId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `g-${(seq += 1)}`;

export function blankGoal(period = 'year') {
  return {
    id: newId(),
    label: '',
    metric: 'sides',
    target: 0,
    period,
    start: '',
    end: '',
    manualCurrent: 0
  };
}

export function migrateGoal(raw) {
  const goal = blankGoal();
  if (!isObject(raw)) return goal;

  goal.id = typeof raw.id === 'string' && raw.id ? raw.id : goal.id;
  goal.label = typeof raw.label === 'string' ? raw.label.trim() : '';
  goal.metric = METRIC_KEYS.has(raw.metric) ? raw.metric : 'manual';
  goal.target = toNumber(raw.target);
  goal.period = PERIODS.some((p) => p.key === raw.period) ? raw.period : 'year';
  goal.start = isDateKey(raw.start) ? raw.start : '';
  goal.end = isDateKey(raw.end) ? raw.end : '';
  goal.manualCurrent = toNumber(raw.manualCurrent ?? raw.current);

  // A goal carried over from the first version has no metric and a typed
  // number; keep the number rather than silently zeroing their progress.
  if (!METRIC_KEYS.has(raw.metric) && toNumber(raw.current)) {
    goal.metric = 'manual';
    goal.manualCurrent = toNumber(raw.current);
  }

  return goal;
}

export const migrateGoals = (raw) =>
  (Array.isArray(raw) ? raw : []).map(migrateGoal).filter((g) => g.label);

/**
 * First and last date key of the period a goal is measured over.
 *
 * `cycle` is the span between coaching sessions, passed in because only the app
 * knows when those are. It is the rhythm the agent actually works in, so a goal
 * set against it moves with a session that slips rather than silently
 * mis-reporting. Without one, a cycle goal falls back to a fortnight.
 */
export function periodRange(goal, today = todayKey(), cycle = null) {
  const now = keyToDate(today);
  const year = now.getFullYear();

  if (goal.period === 'cycle') {
    if (cycle?.start && cycle?.end) return { start: cycle.start, end: cycle.end };
    const back = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 13);
    return { start: dateToKey(back), end: today };
  }

  if (goal.period === 'month') {
    return {
      start: dateToKey(new Date(year, now.getMonth(), 1)),
      end: dateToKey(new Date(year, now.getMonth() + 1, 0))
    };
  }
  if (goal.period === 'quarter') {
    const firstMonth = Math.floor(now.getMonth() / 3) * 3;
    return {
      start: dateToKey(new Date(year, firstMonth, 1)),
      end: dateToKey(new Date(year, firstMonth + 3, 0))
    };
  }
  if (goal.period === 'custom' && goal.start && goal.end) {
    return { start: goal.start, end: goal.end };
  }
  return { start: dateToKey(new Date(year, 0, 1)), end: dateToKey(new Date(year, 11, 31)) };
}

const dayCount = (start, end) =>
  Math.round((keyToDate(end) - keyToDate(start)) / 86400000) + 1;

/** Sum whatever this goal measures across its period. */
export function measure(goal, entriesByDate, range) {
  if (goal.metric === 'manual') return goal.manualCurrent;

  let total = 0;
  const days = dayCount(range.start, range.end);
  const first = keyToDate(range.start);

  for (let i = 0; i < days; i += 1) {
    const key = dateToKey(new Date(first.getFullYear(), first.getMonth(), first.getDate() + i));
    const entry = entriesByDate?.[key];
    if (!entry) continue;

    if (goal.metric === 'sides') total += weightedSides(entry.production);
    else if (PRODUCTION_KEYS.includes(goal.metric)) total += entry.production?.[goal.metric] || 0;
    else if (ACTIVITY_KEYS.includes(goal.metric)) total += entry.activities?.[goal.metric] || 0;
  }

  return Math.round(total * 100) / 100;
}

/**
 * Everything needed to render one goal: where it stands, and — more usefully at
 * a coaching session — whether that is ahead or behind where it should be.
 */
export function tabulate(goal, entriesByDate, today = todayKey(), cycle = null) {
  const range = periodRange(goal, today, cycle);
  const current = measure(goal, entriesByDate, range);
  const target = goal.target;

  const totalDays = dayCount(range.start, range.end);
  const elapsed = Math.min(Math.max(dayCount(range.start, today), 0), totalDays);
  const notStarted = today < range.start;
  const finished = today > range.end;

  const fraction = notStarted ? 0 : finished ? 1 : totalDays > 0 ? elapsed / totalDays : 1;
  const expected = target * fraction;
  const delta = Math.round((current - expected) * 10) / 10;

  return {
    goal,
    range,
    current,
    target,
    percent: target > 0 ? Math.min(999, Math.round((current / target) * 100)) : null,
    daysLeft: Math.max(0, dayCount(today, range.end) - 1),
    expected: Math.round(expected * 10) / 10,
    delta,
    // Whole units, because "34.6 calls behind" is false precision — you cannot
    // make six tenths of a call.
    deltaWhole: Math.round(Math.abs(delta)),
    // Less than one unit either way is not worth a verdict. Reporting "0.1
    // ahead" reads as a finding when it is rounding.
    onPace: target > 0 && Math.abs(delta) < 1,
    // Pace is meaningless before a period starts, and after it ends the only
    // question is whether the target was hit.
    onTrack: target > 0 ? (finished ? current >= target : delta >= 0) : null,
    finished,
    notStarted,
    tracked: goal.metric !== 'manual'
  };
}

/** Goals arranged the way they are read: shortest horizon first. */
export function groupByPeriod(goals, entriesByDate, today = todayKey(), cycle = null) {
  return PERIODS.map((period) => ({
    ...period,
    goals: goals
      .filter((g) => g.period === period.key)
      .map((g) => tabulate(g, entriesByDate, today, cycle))
  })).filter((group) => group.goals.length > 0);
}

/** How a single goal's pace reads in words. Shared by the UI and the form. */
export function paceLabel(t) {
  if (t.onTrack === null) return '';
  if (t.finished) return t.onTrack ? 'hit' : 'missed';
  if (t.onPace) return 'on pace';
  return t.delta > 0 ? `${t.deltaWhole} ahead of pace` : `${t.deltaWhole} behind pace`;
}

/** The "Progress toward goals" answer on the broker's form. */
export function goalsNarrative(goals, entriesByDate, today = todayKey(), cycle = null) {
  const groups = groupByPeriod(goals, entriesByDate, today, cycle);
  if (!groups.length) return '';

  return groups
    .map((group) => {
      const lines = group.goals.map((t) => {
        const name = t.goal.label;
        if (!t.target) return `${name}: ${t.current}`;
        const pace = paceLabel(t);
        return `${name}: ${t.current} of ${t.target}${pace ? ` — ${pace}` : ''}`;
      });
      return `${group.label}\n${lines.join('\n')}`;
    })
    .join('\n\n');
}
