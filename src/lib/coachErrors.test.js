import { describe, it, expect } from 'vitest';
import { explainFailure, failureMessage } from './coachErrors.js';

const withReason = (reason, message = '') => ({ message, details: [{ reason }] });

describe('explainFailure — stops blaming the key for everything', () => {
  it('names a genuinely bad key', () => {
    const out = explainFailure(400, withReason('API_KEY_INVALID', 'API key not valid.'));
    expect(out.title).toMatch(/not accepted/i);
    expect(out.retryable).toBe(false);
  });

  it('does NOT blame the key when the API is disabled for the project', () => {
    const out = explainFailure(
      403,
      withReason('SERVICE_DISABLED', 'Generative Language API has not been used in project 123 before')
    );
    expect(out.title).toMatch(/key is fine/i);
    expect(out.title).not.toMatch(/not accepted|rejected/i);
    expect(out.fix).toMatch(/Generative Language API/);
  });

  it('does NOT blame the key when quota is exhausted', () => {
    const out = explainFailure(429, { message: 'Quota exceeded' });
    expect(out.title).toMatch(/free usage limit/i);
    expect(out.fix).toMatch(/Nothing is broken/i);
    expect(out.retryable).toBe(true);
  });

  it('recognises a rate limit signalled by reason rather than status', () => {
    expect(explainFailure(400, withReason('RATE_LIMIT_EXCEEDED')).retryable).toBe(true);
  });

  it('spots a browser-restricted key', () => {
    const out = explainFailure(403, { message: 'Requests from referer https://x are blocked.' });
    expect(out.title).toMatch(/restricted/i);
    expect(out.fix).toMatch(/referrer|restriction/i);
  });

  it('treats a retired model as an app problem, not a user problem', () => {
    const out = explainFailure(404, { message: 'models/gemini-x is not found' });
    expect(out.title).toMatch(/no longer available/i);
    expect(out.fix).toMatch(/maintains it/i);
    expect(out.retryable).toBe(false);
  });

  it('treats an overloaded model as transient', () => {
    expect(explainFailure(503, { message: 'The model is overloaded.' }).retryable).toBe(true);
    expect(explainFailure(500, {}).retryable).toBe(true);
  });

  it('falls back without crashing on an unrecognised shape', () => {
    for (const bad of [undefined, null, {}, { details: 'nope' }, { details: [] }]) {
      const out = explainFailure(418, bad);
      expect(typeof out.title).toBe('string');
      expect(out.title.length).toBeGreaterThan(0);
    }
  });

  it('never tells a user to regenerate a key for a transient failure', () => {
    for (const status of [429, 500, 503]) {
      expect(explainFailure(status, {}).fix).not.toMatch(/create a fresh key|new one/i);
    }
  });
});

describe('failureMessage', () => {
  it('combines the diagnosis and the fix into one line', () => {
    const line = failureMessage(429, { message: 'Quota exceeded' });
    expect(line).toMatch(/free usage limit/i);
    expect(line).toMatch(/try again/i);
  });
});
