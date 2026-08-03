import { describe, it, expect } from 'vitest';
import { initials } from './format.js';

describe('initials', () => {
  it('uses first and last name', () => {
    expect(initials('Adam Grenville', 'x@y.com')).toBe('AG');
  });

  it('falls back to the email when there is no name', () => {
    expect(initials('', 'adam.grenville@gmail.com')).toBe('AG');
    expect(initials(null, 'adam@gmail.com')).toBe('A');
  });

  it('does not take initials from the email domain', () => {
    expect(initials('', 'adam@zillow.com')).toBe('A');
  });

  it('handles a single name', () => {
    expect(initials('Adam', '')).toBe('A');
  });

  it('handles three or more names by using first and last', () => {
    expect(initials('Adam John Grenville', '')).toBe('AG');
  });

  it('splits on separators found in email addresses', () => {
    expect(initials('', 'adam_grenville@x.com')).toBe('AG');
    expect(initials('', 'adam-grenville@x.com')).toBe('AG');
  });

  it('never returns an empty label', () => {
    for (const [n, e] of [['', ''], [null, null], [undefined, undefined], ['   ', '  ']]) {
      expect(initials(n, e)).toBe('?');
    }
  });

  it('uppercases regardless of input', () => {
    expect(initials('adam grenville', '')).toBe('AG');
  });
});
