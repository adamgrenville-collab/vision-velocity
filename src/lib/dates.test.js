import { describe, it, expect } from 'vitest';
import { dateToKey, keyToDate, shiftKey, formatKey, todayKey } from './dates.js';

describe('dateToKey', () => {
  it('zero-pads month and day', () => {
    expect(dateToKey(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('uses local calendar fields, not UTC', () => {
    // 11pm local on Aug 1 is already Aug 2 in UTC for US timezones. The key
    // must still say Aug 1 — that is the day the user actually lived.
    expect(dateToKey(new Date(2026, 7, 1, 23, 30))).toBe('2026-08-01');
  });

  it('round-trips through keyToDate', () => {
    for (const key of ['2026-08-01', '2026-01-01', '2026-12-31', '2024-02-29']) {
      expect(dateToKey(keyToDate(key))).toBe(key);
    }
  });
});

describe('keyToDate', () => {
  it('returns local midnight, not UTC midnight', () => {
    const d = keyToDate('2026-08-01');
    expect(d.getFullYear()).toBe(2026);
    expect(d.getMonth()).toBe(7);
    expect(d.getDate()).toBe(1);
    expect(d.getHours()).toBe(0);
  });

  it('does not drift the way new Date(key) does', () => {
    // This is the exact bug that shipped: guard against regressing to it.
    const viaHelper = keyToDate('2026-08-01').getDate();
    const viaNaiveParse = new Date('2026-08-01').getDate();
    const offset = new Date(2026, 7, 1).getTimezoneOffset();
    if (offset > 0) {
      // West of UTC (all of the US): naive parsing lands on the previous day.
      expect(viaNaiveParse).not.toBe(viaHelper);
    }
    expect(viaHelper).toBe(1);
  });
});

describe('shiftKey', () => {
  it('moves forward and back by a day', () => {
    expect(shiftKey('2026-08-01', 1)).toBe('2026-08-02');
    expect(shiftKey('2026-08-01', -1)).toBe('2026-07-31');
  });

  it('crosses month boundaries', () => {
    expect(shiftKey('2026-07-31', 1)).toBe('2026-08-01');
    expect(shiftKey('2026-08-01', -1)).toBe('2026-07-31');
  });

  it('crosses year boundaries', () => {
    expect(shiftKey('2026-12-31', 1)).toBe('2027-01-01');
    expect(shiftKey('2026-01-01', -1)).toBe('2025-12-31');
  });

  it('handles leap days', () => {
    expect(shiftKey('2024-02-28', 1)).toBe('2024-02-29');
    expect(shiftKey('2024-02-29', 1)).toBe('2024-03-01');
    expect(shiftKey('2025-02-28', 1)).toBe('2025-03-01');
  });

  it('survives a DST spring-forward without losing a day', () => {
    // US DST 2026 starts Mar 8. Stepping across it must still advance by one.
    expect(shiftKey('2026-03-07', 1)).toBe('2026-03-08');
    expect(shiftKey('2026-03-08', 1)).toBe('2026-03-09');
  });

  it('survives a DST fall-back without repeating a day', () => {
    // US DST 2026 ends Nov 1.
    expect(shiftKey('2026-10-31', 1)).toBe('2026-11-01');
    expect(shiftKey('2026-11-01', 1)).toBe('2026-11-02');
  });

  it('is reversible across DST boundaries', () => {
    for (const key of ['2026-03-08', '2026-11-01', '2026-06-15']) {
      expect(shiftKey(shiftKey(key, 1), -1)).toBe(key);
    }
  });
});

describe('formatKey', () => {
  it('labels the stored day, not the day before', () => {
    expect(formatKey('2026-08-01', 'en-US')).toBe('Saturday, Aug 1');
  });

  it('labels the first of a month correctly', () => {
    expect(formatKey('2026-01-01', 'en-US')).toBe('Thursday, Jan 1');
  });
});

describe('todayKey', () => {
  it('matches the local date', () => {
    expect(todayKey()).toBe(dateToKey(new Date()));
  });

  it('is a well-formed key', () => {
    expect(todayKey()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
