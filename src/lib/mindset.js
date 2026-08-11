/**
 * Cumulative mindset across a coaching cycle.
 *
 * The nightly check-in asks three questions and then the answers are never seen
 * again. Over a fortnight they are the most useful thing in the app: a broker
 * asking "what slowed you down" gets a better answer from fourteen honest
 * one-liners written at 10pm than from memory on the drive over.
 *
 * This also looks for the one correlation the numbers alone cannot show —
 * whether the days that felt bad were actually the days that produced less.
 *
 * Deliberately arithmetic, not AI: it works with no API key, and a broker can
 * check every figure against the daily log.
 */
import { ACTIVITY_KEYS } from './entries.js';

/** Words too common to be a theme. */
const STOPWORDS = new Set(
  ('a an and the to of in on for with at by from up out i my me we it is was were be been am are ' +
    'do did done doing have has had not no so too very just but or if then than that this these those ' +
    'got get getting go going went day today all lot much many some any more most only really quite ' +
    'felt feel feeling was were about into over back down off again still even much')
    .split(/\s+/)
);

const clean = (value) => String(value || '').trim();

const totalActivity = (entry) =>
  ACTIVITY_KEYS.reduce((sum, key) => sum + (entry.activities?.[key] || 0), 0);

const mean = (numbers) =>
  numbers.length ? numbers.reduce((a, b) => a + b, 0) / numbers.length : 0;

/**
 * Words appearing across two or more separate days, most frequent first.
 * One mention is an incident; the same word on three nights is a pattern.
 */
export function themes(texts, { minDays = 2, limit = 5 } = {}) {
  const daysByWord = new Map();

  texts.forEach((text, index) => {
    const seen = new Set();
    for (const raw of String(text || '').toLowerCase().split(/[^a-z']+/)) {
      const word = raw.replace(/^'+|'+$/g, '');
      if (word.length < 4 || STOPWORDS.has(word) || seen.has(word)) continue;
      seen.add(word);
      if (!daysByWord.has(word)) daysByWord.set(word, new Set());
      daysByWord.get(word).add(index);
    }
  });

  return [...daysByWord.entries()]
    .map(([word, days]) => ({ word, days: days.size }))
    .filter((t) => t.days >= minDays)
    .sort((a, b) => b.days - a.days || a.word.localeCompare(b.word))
    .slice(0, limit);
}

/**
 * @returns {{
 *   days: Array, feelings: Array, wins: Array, roadblocks: Array,
 *   roadblockThemes: Array, checkedIn: number, effect: object|null,
 *   bestDay: object|null, hardestDay: object|null
 * }}
 */
export function mindsetSummary(entriesByDate, dateKeys) {
  const days = [];

  for (const date of dateKeys) {
    const entry = entriesByDate?.[date];
    if (!entry) continue;
    days.push({
      date,
      dayOff: entry.dayOff === true,
      activity: totalActivity(entry),
      feeling: clean(entry.mindset?.feeling),
      win: clean(entry.mindset?.win),
      roadblock: clean(entry.mindset?.roadblock)
    });
  }

  const withText = (field) => days.filter((d) => d[field]).map((d) => ({ date: d.date, text: d[field] }));

  const feelings = withText('feeling');
  const wins = withText('win');
  const roadblocks = withText('roadblock');
  const checkedIn = days.filter((d) => d.feeling || d.win || d.roadblock).length;

  // Only worked days count — a planned day off is not a bad day.
  const worked = days.filter((d) => !d.dayOff);
  const blocked = worked.filter((d) => d.roadblock);
  const clear = worked.filter((d) => !d.roadblock);

  /**
   * Reported only with at least two days on each side. Below that it is one
   * anecdote wearing a percentage sign, and a coaching conversation should not
   * be built on it.
   */
  let effect = null;
  if (blocked.length >= 2 && clear.length >= 2) {
    const blockedMean = mean(blocked.map((d) => d.activity));
    const clearMean = mean(clear.map((d) => d.activity));
    const change = clearMean > 0 ? Math.round(((blockedMean - clearMean) / clearMean) * 100) : 0;
    effect = {
      blockedDays: blocked.length,
      clearDays: clear.length,
      blockedMean: Math.round(blockedMean * 10) / 10,
      clearMean: Math.round(clearMean * 10) / 10,
      changePercent: change
    };
  }

  const ranked = [...worked].filter((d) => d.activity > 0).sort((a, b) => b.activity - a.activity);

  return {
    days,
    feelings,
    wins,
    roadblocks,
    roadblockThemes: themes(roadblocks.map((r) => r.text)),
    checkedIn,
    effect,
    bestDay: ranked[0] || null,
    hardestDay: ranked.length > 1 ? ranked[ranked.length - 1] : null
  };
}

/** One paragraph for the broker's form, or for the coach to build on. */
export function mindsetNarrative(summary) {
  if (!summary.checkedIn) return '';

  const parts = [];
  parts.push(`Checked in on ${summary.checkedIn} ${summary.checkedIn === 1 ? 'day' : 'days'}.`);

  if (summary.roadblocks.length) {
    parts.push(
      `Named something that slowed me down on ${summary.roadblocks.length} of them` +
        (summary.roadblockThemes.length
          ? `, recurring around: ${summary.roadblockThemes.map((t) => t.word).join(', ')}.`
          : '.')
    );
  }

  if (summary.effect) {
    const { changePercent, blockedDays, clearDays } = summary.effect;
    parts.push(
      changePercent < 0
        ? `Activity ran ${Math.abs(changePercent)}% lower on the ${blockedDays} blocked days than on the ${clearDays} clear ones.`
        : changePercent > 0
          ? `Activity held up on blocked days — ${changePercent}% higher than clear ones.`
          : 'Activity was level whether or not something got in the way.'
    );
  }

  if (summary.wins.length) {
    parts.push(`Logged ${summary.wins.length} ${summary.wins.length === 1 ? 'win' : 'wins'}.`);
  }

  return parts.join(' ');
}
