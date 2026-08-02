/**
 * Entries are keyed by YYYY-MM-DD and must be treated as LOCAL calendar days.
 *
 * The trap: `new Date('2026-08-01')` parses as UTC midnight, which is 8pm on
 * July 31st in Florida. Formatting that with toLocaleDateString labelled every
 * entry with the previous day's date. Always go through these helpers.
 */

/** Date object -> 'YYYY-MM-DD' using local calendar fields. */
export function dateToKey(date) {
  return (
    date.getFullYear() +
    '-' +
    String(date.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(date.getDate()).padStart(2, '0')
  );
}

/** 'YYYY-MM-DD' -> Date at local midnight. Never `new Date(key)`. */
export function keyToDate(key) {
  const [year, month, day] = String(key).split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** Today's key, in the user's own timezone. */
export function todayKey() {
  return dateToKey(new Date());
}

/** Shift a key by N days, staying on local calendar days. */
export function shiftKey(key, days) {
  const date = keyToDate(key);
  date.setDate(date.getDate() + days);
  return dateToKey(date);
}

/** 'Saturday, Aug 1' */
export function formatKey(key, locale = undefined) {
  return keyToDate(key).toLocaleDateString(locale, {
    weekday: 'long',
    month: 'short',
    day: 'numeric'
  });
}
